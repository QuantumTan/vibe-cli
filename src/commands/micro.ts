import path from 'path';
import fs from 'fs-extra';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { copyToClipboard } from './prompt.js';
import { inspectProject } from '../inspector.js';
import { decomposeTask, executeVerifyLoop, parseSearchReplaceBlocks } from '../core/verify-loop.js';
import { collectSourceFiles } from './map.js';

export interface MicroOptions {
  verify?: string;
  file?: string;
  patch?: string;
}

/**
 * vibe micro "<task>" [--verify "<cmd>"]
 */
export async function microCommand(taskInput?: string, options: MicroOptions = {}): Promise<void> {
  const cwd = process.cwd();
  p.intro(pc.bgMagenta(pc.black(' vibe micro ')) + ' ' + pc.bold('Small-Model Atomic Micro-Task & Verify Loop'));

  let task = taskInput;
  if (!task) {
    const input = await p.text({
      message: 'Describe the atomic task / bugfix to decompose for 3B–8B models:',
      placeholder: 'Add email regex validation to User registration input',
      validate: (val) => (!val?.trim() ? 'Task description is required' : undefined),
    });

    if (p.isCancel(input)) {
      p.cancel('Micro-task canceled.');
      return;
    }
    task = input.trim();
  }

  const meta = await inspectProject(cwd);
  const verifyCmd = options.verify || meta.verifyCmd || 'npx tsc --noEmit';

  const s = p.spinner();
  s.start('Decomposing task into single-file atomic scope...');

  const allFiles = await collectSourceFiles(cwd);
  const relevantFiles = options.file
    ? [options.file]
    : allFiles.filter((f) => {
        const lower = f.toLowerCase();
        return (
          lower.includes('user') ||
          lower.includes('auth') ||
          lower.includes('route') ||
          lower.includes('index') ||
          lower.includes('app')
        );
      });

  const steps = decomposeTask(task, relevantFiles);
  s.stop(pc.green(`Decomposed into ${steps.length} atomic step(s)!`));

  // If a patch file or direct patch is supplied, run the verify loop
  if (options.patch && options.file) {
    const patchContent = (await fs.pathExists(options.patch))
      ? await fs.readFile(options.patch, 'utf8')
      : options.patch;

    const sLoop = p.spinner();
    sLoop.start(`Applying search-replace patch and verifying with \`${verifyCmd}\`...`);

    const result = await executeVerifyLoop(cwd, options.file, patchContent, verifyCmd);

    if (result.success) {
      sLoop.stop(pc.green('✔ Micro-task patch verified and passed! Codebase compiles cleanly.'));
      p.outro(pc.green('Atomic step complete!'));
      return;
    } else {
      sLoop.stop(pc.red('✖ Verification failed.'));
      if (result.reverted) {
        p.log.warn('Safety shield triggered: Workspace automatically reverted to pre-edit state.');
      }
      if (result.truncatedCompilerError) {
        p.note(result.truncatedCompilerError, 'Compiler Error (< 300 tokens for model feedback)');
      }
      p.outro(pc.yellow('Refine the patch or provide surgical compiler error back to agent.'));
      return;
    }
  }

  // Generate surgical small-model prompt with SEARCH/REPLACE guidelines
  const targetFileExample = relevantFiles[0] || 'src/index.ts';
  const promptDirective = `### Task: ${task}
Target File: \`${targetFileExample}\`

Constraints for 3B-8B Models:
1. Modify ONLY this single file. Do NOT perform full-file rewrites.
2. Return code ONLY in strict diff format:
<<<< SEARCH
exact existing lines to replace
====
replacement lines
>>>> REPLACE

3. Ensure no trailing syntax errors. Verification command will be: \`${verifyCmd}\`.`;

  await copyToClipboard(promptDirective);

  p.note(
    `1. Target Scope:   ${pc.cyan(targetFileExample)} (Single-file bounded)\n` +
      `2. Format:         ${pc.yellow('<<<< SEARCH / ==== / >>>> REPLACE')}\n` +
      `3. Verify Guard:   ${pc.white(verifyCmd)}\n\n` +
      `Micro-task prompt copied to clipboard! Paste directly into local Ollama / LM Studio.`,
    'Small-Model Guardrail Ready'
  );

  p.outro('Small models (3B–8B) produce reliable, non-truncated code when given single-file diff blocks.');
}
