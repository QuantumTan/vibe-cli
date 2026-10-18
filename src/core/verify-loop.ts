import path from 'path';
import fs from 'fs-extra';
import { spawn } from 'node:child_process';
import { createCheckpoint, restoreCheckpoint, CheckpointManifest } from '../commands/checkpoint.js';
import { estimateTokens } from '../utils/token-estimator.js';

export interface SearchReplaceBlock {
  search: string;
  replace: string;
}

export interface VerifyLoopResult {
  success: boolean;
  retriesUsed: number;
  checkpointId?: string;
  reverted: boolean;
  error?: string;
  truncatedCompilerError?: string;
}

/**
 * Parses <<<< SEARCH / ==== / >>>> REPLACE blocks from model output.
 */
export function parseSearchReplaceBlocks(text: string): SearchReplaceBlock[] {
  const blocks: SearchReplaceBlock[] = [];
  const regex = /<<<<\s*SEARCH\r?\n([\s\S]*?)\r?\n====\r?\n([\s\S]*?)\r?\n>>>>\s*REPLACE/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    blocks.push({
      search: match[1],
      replace: match[2],
    });
  }

  return blocks;
}

/**
 * Applies search/replace blocks to target file content.
 */
export function applySearchReplace(
  fileContent: string,
  blocks: SearchReplaceBlock[]
): { success: boolean; updatedContent: string; error?: string } {
  let content = fileContent;

  for (let i = 0; i < blocks.length; i++) {
    const { search, replace } = blocks[i];
    if (content.includes(search)) {
      // Direct exact match
      content = content.replace(search, replace);
    } else {
      // Normalize line endings and try again
      const normalizedContent = content.replace(/\r\n/g, '\n');
      const normalizedSearch = search.replace(/\r\n/g, '\n');
      const normalizedReplace = replace.replace(/\r\n/g, '\n');

      if (normalizedContent.includes(normalizedSearch)) {
        content = normalizedContent.replace(normalizedSearch, normalizedReplace);
      } else {
        return {
          success: false,
          updatedContent: fileContent,
          error: `Block ${i + 1} failed: search block not found in target file. Ensure exact matching lines are provided.`,
        };
      }
    }
  }

  return { success: true, updatedContent: content };
}

/**
 * Filters and truncates compiler errors to < 300 tokens.
 */
export function truncateCompilerError(rawOutput: string, maxTokens = 300): string {
  if (!rawOutput) return '';

  const lines = rawOutput.split(/\r?\n/);
  const relevantLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Filter noise lines
    if (
      trimmed.startsWith('>') ||
      trimmed.startsWith('npm ') ||
      trimmed.includes('node_modules') ||
      trimmed.includes('tsup')
    ) {
      continue;
    }

    // Keep error lines, file pointers, and problem statements
    if (
      trimmed.includes('error TS') ||
      trimmed.includes('Error:') ||
      trimmed.includes('error:') ||
      trimmed.includes('FAILED') ||
      trimmed.includes('Expected') ||
      trimmed.includes('Type ') ||
      trimmed.includes('Cannot find')
    ) {
      relevantLines.push(trimmed);
    } else if (relevantLines.length > 0 && relevantLines.length < 15) {
      relevantLines.push(trimmed);
    }
  }

  let result = relevantLines.join('\n');
  if (!result) {
    result = lines.slice(0, 10).join('\n');
  }

  // Ensure < maxTokens tokens
  let tokens = estimateTokens(result);
  if (tokens > maxTokens) {
    const charCap = Math.floor(maxTokens * 3.6);
    result = result.substring(0, charCap) + '\n... [truncated]';
  }

  return result;
}

/**
 * Runs the project verification command safely.
 */
export function runVerificationCommand(cmd: string, cwd: string): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, { cwd, shell: true });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));

    child.on('close', (code) => {
      const output = (stderr + '\n' + stdout).trim();
      resolve({
        success: code === 0,
        output,
      });
    });

    child.on('error', (err) => {
      resolve({
        success: false,
        output: err.message,
      });
    });
  });
}

/**
 * Decomposes a task into single-file atomic micro-steps.
 */
export function decomposeTask(taskDescription: string, files: string[]): Array<{ step: number; file: string; action: string }> {
  // If target files provided, limit step to at most 1 file per step
  if (files.length > 0) {
    return files.slice(0, 5).map((file, idx) => ({
      step: idx + 1,
      file,
      action: `Atomic patch for ${file}: Implement single responsibility step from "${taskDescription}"`,
    }));
  }

  return [
    {
      step: 1,
      file: 'auto-detect',
      action: `Atomic patch: ${taskDescription}`,
    },
  ];
}

/**
 * Executes the micro-verify loop with up to 2 self-healing retries.
 */
export async function executeVerifyLoop(
  cwd: string,
  targetFile: string,
  patchText: string,
  verifyCmd = 'npx tsc --noEmit',
  mockRetryFn?: (errorReport: string) => Promise<string>
): Promise<VerifyLoopResult> {
  // 1. Create safety snapshot checkpoint
  const checkpoint = await createCheckpoint(cwd, `Before micro-task on ${path.basename(targetFile)}`);

  const absPath = path.resolve(cwd, targetFile);
  if (!(await fs.pathExists(absPath))) {
    return {
      success: false,
      retriesUsed: 0,
      checkpointId: checkpoint.id,
      reverted: false,
      error: `Target file not found: ${targetFile}`,
    };
  }

  const originalContent = await fs.readFile(absPath, 'utf8');

  const revertTarget = async () => {
    await fs.writeFile(absPath, originalContent, 'utf8');
    await restoreCheckpoint(cwd, checkpoint.id);
  };

  // 2. Parse & apply search-replace blocks
  let currentPatch = patchText;
  let retriesUsed = 0;
  const maxRetries = 2;

  while (retriesUsed <= maxRetries) {
    const blocks = parseSearchReplaceBlocks(currentPatch);
    if (blocks.length === 0) {
      await revertTarget();
      return {
        success: false,
        retriesUsed,
        checkpointId: checkpoint.id,
        reverted: true,
        error: 'No valid <<<< SEARCH / ==== / >>>> REPLACE blocks found in patch.',
      };
    }

    const applied = applySearchReplace(originalContent, blocks);
    if (!applied.success) {
      if (retriesUsed < maxRetries && mockRetryFn) {
        retriesUsed++;
        currentPatch = await mockRetryFn(applied.error || 'Search block matching failed');
        continue;
      }
      await revertTarget();
      return {
        success: false,
        retriesUsed,
        checkpointId: checkpoint.id,
        reverted: true,
        error: applied.error,
      };
    }

    // Write applied content
    await fs.writeFile(absPath, applied.updatedContent, 'utf8');

    // 3. Run verification command
    const verifyResult = await runVerificationCommand(verifyCmd, cwd);
    if (verifyResult.success) {
      return {
        success: true,
        retriesUsed,
        checkpointId: checkpoint.id,
        reverted: false,
      };
    }

    // Verification failed: truncate compiler error
    const truncatedErr = truncateCompilerError(verifyResult.output);

    if (retriesUsed < maxRetries && mockRetryFn) {
      retriesUsed++;
      currentPatch = await mockRetryFn(truncatedErr);
    } else {
      // Final failure: automatically restore checkpoint to protect codebase
      await revertTarget();
      return {
        success: false,
        retriesUsed,
        checkpointId: checkpoint.id,
        reverted: true,
        truncatedCompilerError: truncatedErr,
        error: `Verification command failed (${verifyCmd}). Workspace automatically restored to checkpoint.`,
      };
    }
  }

  // Fallback auto-restore
  await revertTarget();
  return {
    success: false,
    retriesUsed,
    checkpointId: checkpoint.id,
    reverted: true,
    error: 'Max retries exhausted. Workspace restored.',
  };
}
