import path from 'path';
import fs from 'fs-extra';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { copyToClipboard } from './prompt.js';
import { collectSourceFiles } from './map.js';

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

/**
 * Strips verbose comments, multi-line blocks, and excessive whitespace.
 */
export function minifySource(content: string, signaturesOnly = false): string {
  // Strip block comments /* ... */
  let stripped = content.replace(/\/\*[\s\S]*?\*\//g, '');
  // Strip single-line comments // ...
  stripped = stripped.replace(/^\s*\/\/.*$/gm, '');

  if (signaturesOnly) {
    // If signatures only, extract export statements, types, interfaces, and function headers without bodies
    const lines = stripped.split('\n');
    const signatureLines: string[] = [];
    let insideFnBody = false;
    let braceDepth = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Retain imports, type definitions, interfaces, exports
      if (
        trimmed.startsWith('import ') ||
        trimmed.startsWith('export type ') ||
        trimmed.startsWith('export interface ') ||
        trimmed.startsWith('type ') ||
        trimmed.startsWith('interface ')
      ) {
        signatureLines.push(trimmed);
        continue;
      }

      // If function definition
      if (
        (trimmed.startsWith('export function ') ||
          trimmed.startsWith('export async function ') ||
          trimmed.startsWith('function ') ||
          trimmed.startsWith('def ')) &&
        trimmed.includes('(')
      ) {
        const header = trimmed.replace(/\{.*$/, '').trim();
        signatureLines.push(`${header};`);
        continue;
      }

      // If class definition
      if (trimmed.startsWith('export class ') || trimmed.startsWith('class ')) {
        const header = trimmed.replace(/\{.*$/, '').trim();
        signatureLines.push(`${header} { ... }`);
        continue;
      }
    }

    if (signatureLines.length > 0) {
      return signatureLines.join('\n');
    }
  }

  // Remove redundant empty lines
  return stripped.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
}

/**
 * Estimates LLM token count from string length (~4 chars per token).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
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
        relPath,
        originalSize: original.length,
        packedSize: minified.length,
        content: minified,
      });
    } catch {
      // Skip unreadable files
    }
  }

  const originalTokens = estimateTokens(totalOrigChars.toString().repeat(Math.ceil(totalOrigChars / 10)));
  const actualOrigTokens = Math.ceil(totalOrigChars / 4);
  const packedTokens = Math.ceil(totalPackedChars / 4);
  const savingsPercent =
    actualOrigTokens > 0 ? Math.round(((actualOrigTokens - packedTokens) / actualOrigTokens) * 100) : 0;

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
  options: { signaturesOnly?: boolean; clipboard?: boolean; out?: string } = {}
): Promise<void> {
  const cwd = process.cwd();
  p.intro(pc.bgMagenta(pc.black(' vibe pack ')) + ' ' + pc.bold('Token-Optimized AI Context Packer'));

  const s = p.spinner();
  s.start('Collecting source files and compressing AST / token payload...');

  const result = await packSourceFiles(cwd, targetPatternInput, options.signaturesOnly);

  if (result.totalFiles === 0) {
    s.stop(pc.yellow('No source files found to pack.'));
    p.outro('Context pack empty.');
    return;
  }

  s.stop(pc.green(`Packed ${result.totalFiles} file(s)! (~${result.packedTokens} tokens, saved ${result.savingsPercent}%)`));

  // Determine save location
  const vaultPackDir = path.join(cwd, '.vault', 'Context-Packs');
  const targetDir = (await fs.pathExists(path.join(cwd, '.vault'))) ? vaultPackDir : path.join(cwd, 'dist');
  await fs.ensureDir(targetDir);

  const packFileName = `Pack-${Date.now()}.md`;
  const outFile = options.out ? path.resolve(options.out) : path.join(targetDir, packFileName);
  await fs.writeFile(outFile, result.payload, 'utf8');

  // Copy to clipboard if requested or default
  const copied = await copyToClipboard(result.payload);

  p.note(
    `Files Packed:    ${pc.bold(pc.cyan(result.totalFiles.toString()))} file(s)\n` +
      `Est. Tokens:     ${pc.bold(pc.green(`~${result.packedTokens}`))} (Saved ${pc.bold(pc.yellow(`${result.savingsPercent}%`))})\n` +
      `Saved Payload:   ${pc.white(outFile)}\n` +
      `Clipboard:       ${copied ? pc.green('✔ Copied to Windows Clipboard!') : pc.dim('Clipboard unavailable')}\n\n` +
      `Ready to paste into Antigravity, Cursor, or Claude prompt without context bloat!`,
    'Context Pack Ready'
  );

  p.outro('Zero token waste. AI agent will receive razor-sharp structural context.');
}
