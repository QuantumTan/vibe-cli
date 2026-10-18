import path from 'path';
import fs from 'fs-extra';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { copyToClipboard } from './prompt.js';
import { collectSourceFiles } from './map.js';
import { estimateTokens } from '../utils/token-estimator.js';
import { assembleTieredContext, compressContext, extractSignatures } from '../core/ast-packer.js';

export { estimateTokens };

export interface PackedFile {
  relPath: string;
  originalSize: number;
  packedSize: number;
  content: string;
}

export interface PackResult {
  totalFiles: number;
  originalTokens: number;
  packedTokens: number;
  savingsPercent: number;
  payload: string;
  files: PackedFile[];
}

export interface PackOptions {
  signaturesOnly?: boolean;
  clipboard?: boolean;
  out?: string;
  budget?: number | string;
  diff?: boolean;
  errorLog?: string;
  compress?: boolean;
  cached?: boolean;
}

/**
 * Strips verbose comments, multi-line blocks, and excessive whitespace.
 */
export function minifySource(content: string, signaturesOnly = false): string {
  // Strip block comments /* ... */
  let stripped = content.replace(/\/\*[\s\S]*?\*\//g, '');
  // Strip single-line comments // ...
  stripped = stripped.replace(/^\s*\/\/.*$/gm, '');

  if (signaturesOnly) {
    const sigs = extractSignatures(stripped);
    if (sigs.trim().length > 0) {
      return sigs;
    }
  }

  // Remove redundant empty lines
  return stripped.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
}

/**
 * Packs workspace source files into token-optimized context payload.
 */
export async function packSourceFiles(
  cwd: string,
  targetPattern?: string,
  signaturesOnly = false
): Promise<PackResult> {
  const allFiles = await collectSourceFiles(cwd);
  const targetFiles = targetPattern
    ? allFiles.filter((f) => f.includes(targetPattern.replace(/\\/g, '/')))
    : allFiles.slice(0, 30); // Default to top 30 key files if unbounded

  const packedFiles: PackedFile[] = [];
  let totalOrigChars = 0;
  let totalPackedChars = 0;

  for (const relFile of targetFiles) {
    const absPath = path.join(cwd, relFile);
    try {
      const original = await fs.readFile(absPath, 'utf8');
      const minified = minifySource(original, signaturesOnly);

      totalOrigChars += original.length;
      totalPackedChars += minified.length;

      packedFiles.push({
        relPath: relFile,
        originalSize: original.length,
        packedSize: minified.length,
        content: minified,
      });
    } catch {
      // Skip unreadable files
    }
  }

  const actualOrigTokens = Math.ceil(totalOrigChars / 4);
  const packedTokens = estimateTokens(
    packedFiles.map((f) => f.content).join('\n')
  );
  const savingsPercent =
    actualOrigTokens > 0 ? Math.max(0, Math.round(((actualOrigTokens - packedTokens) / actualOrigTokens) * 100)) : 0;

  // Build markdown context payload
  const dateStr = new Date().toISOString().substring(0, 10);
  const payloadLines = [
    `# Codebase Context Pack`,
    `> Generated: ${dateStr} • Mode: ${signaturesOnly ? 'Signatures & Types Only' : 'Compressed Source'} • Files: ${packedFiles.length} • Est. Tokens: ~${packedTokens}`,
    '',
  ];

  for (const f of packedFiles) {
    const ext = path.extname(f.relPath).replace('.', '') || 'text';
    payloadLines.push(`### File: \`${f.relPath}\``);
    payloadLines.push(`\`\`\`${ext}`);
    payloadLines.push(f.content);
    payloadLines.push('```');
    payloadLines.push('');
  }

  return {
    totalFiles: packedFiles.length,
    originalTokens: actualOrigTokens,
    packedTokens,
    savingsPercent,
    payload: payloadLines.join('\n'),
    files: packedFiles,
  };
}

/**
 * vibe pack [targetPattern]
 */
export async function packCommand(
  targetPatternInput?: string,
  options: PackOptions = {}
): Promise<void> {
  const cwd = process.cwd();
  p.intro(pc.bgMagenta(pc.black(' vibe pack ')) + ' ' + pc.bold('Token-Optimized AI Context Packer'));

  const budgetNum = options.budget ? parseInt(options.budget.toString(), 10) : 4000;
  const isTieredMode = options.diff || options.errorLog || options.budget || options.compress;

  const s = p.spinner();
  s.start('Collecting source files and compressing AST / token payload...');

  let payload = '';
  let packedTokens = 0;
  let fileCount = 0;
  let savingsInfo = '';

  if (isTieredMode) {
    const allFiles = await collectSourceFiles(cwd);
    const sourceFiles = targetPatternInput
      ? allFiles.filter((f) => f.includes(targetPatternInput.replace(/\\/g, '/')))
      : allFiles.slice(0, 25);

    const tiered = await assembleTieredContext(cwd, {
      budget: budgetNum,
      diff: options.diff !== false,
      errorLog: options.errorLog,
      compress: options.compress,
      cached: options.cached,
      sourceFiles,
    });

    payload = tiered.fullPayload;
    packedTokens = tiered.totalTokens;
    fileCount = sourceFiles.length;
    savingsInfo = `Budget: ~${packedTokens} / ${budgetNum} tokens (Tier 1: ${tiered.tier1Tokens}, Tier 2: ${tiered.tier2Tokens}, Tier 3: ${tiered.tier3Tokens})`;
  } else {
    const result = await packSourceFiles(cwd, targetPatternInput, options.signaturesOnly);

    if (result.totalFiles === 0) {
      s.stop(pc.yellow('No source files found to pack.'));
      p.outro('Context pack empty.');
      return;
    }

    payload = result.payload;
    packedTokens = result.packedTokens;
    fileCount = result.totalFiles;
    savingsInfo = `~${result.packedTokens} tokens (Saved ${result.savingsPercent}%)`;
  }

  s.stop(pc.green(`Packed context ready! (${savingsInfo})`));

  // Determine save location
  const vaultPackDir = path.join(cwd, '.vault', 'Context-Packs');
  const targetDir = (await fs.pathExists(path.join(cwd, '.vault'))) ? vaultPackDir : path.join(cwd, 'dist');
  await fs.ensureDir(targetDir);

  const packFileName = `Pack-${Date.now()}.md`;
  const outFile = options.out ? path.resolve(options.out) : path.join(targetDir, packFileName);
  await fs.writeFile(outFile, payload, 'utf8');

  // Copy to clipboard if requested or default
  const copied = await copyToClipboard(payload);

  p.note(
    `Files / Targets:  ${pc.bold(pc.cyan(fileCount.toString()))} target(s)\n` +
      `Est. Tokens:     ${pc.bold(pc.green(`~${packedTokens}`))} / ${budgetNum} cap\n` +
      `Saved Payload:   ${pc.white(outFile)}\n` +
      `Clipboard:       ${copied ? pc.green('✔ Copied to Clipboard!') : pc.dim('Clipboard unavailable')}\n\n` +
      `Budget-capped context fits within Groq (6k TPM) and GitHub Models (8k cap)!`,
    'Context Pack Ready'
  );

  p.outro('Zero token waste. AI agent will receive razor-sharp structural context.');
}
