import path from 'path';
import fs from 'fs-extra';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { estimateTokens } from '../utils/token-estimator.js';

export interface AstSignatureCache {
  version: number;
  entries: Record<string, { signature: string; updatedAt: string }>;
}

export interface ErrorFrameContext {
  filePath: string;
  line: number;
  snippet: string;
}

export interface TieredContextResult {
  tier1: string; // Diff & Error context
  tier2: string; // AST signatures
  tier3: string; // Compact tree & AGENTS.md
  fullPayload: string;
  totalTokens: number;
  tier1Tokens: number;
  tier2Tokens: number;
  tier3Tokens: number;
  budget: number;
  cachedHitCount: number;
}

/**
 * Computes SHA-256 hash of file content.
 */
export function computeSha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Strips comments, collapses multiple blank lines, and cleans whitespace.
 */
export function compressContext(text: string): string {
  if (!text) return '';

  // 1. Strip multi-line comments /* ... */
  let cleaned = text.replace(/\/\*[\s\S]*?\*\//g, '');

  // 2. Strip single-line comments // ... (except inside URLs like http:// or https://)
  cleaned = cleaned.replace(/^\s*\/\/(?!#).*$/gm, '');

  // 3. Collapse 3+ consecutive blank lines to 1 blank line
  cleaned = cleaned.replace(/\n\s*\n\s*\n+/g, '\n\n');

  // 4. Deduplicate consecutive identical lines (often in stack traces)
  const lines = cleaned.split('\n');
  const deduped: string[] = [];
  let prevLine: string | null = null;
  for (const line of lines) {
    if (line === prevLine && line.trim().startsWith('at ')) {
      continue;
    }
    deduped.push(line);
    prevLine = line;
  }

  return deduped.join('\n').trim();
}

/**
 * Extracts AST signatures (types, interfaces, class declarations, function signatures).
 */
export function extractSignatures(content: string): string {
  // Strip block comments
  let stripped = content.replace(/\/\*[\s\S]*?\*\//g, '');
  // Strip single-line comments
  stripped = stripped.replace(/^\s*\/\/.*$/gm, '');

  const lines = stripped.split('\n');
  const signatureLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Retain imports, type definitions, interfaces
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

    // Function definition headers
    if (
      (trimmed.startsWith('export function ') ||
        trimmed.startsWith('export async function ') ||
        trimmed.startsWith('function ') ||
        trimmed.startsWith('def ')) &&
      trimmed.includes('(')
    ) {
      const header = trimmed.replace(/\{.*$/, '').trim();
      signatureLines.push(header.endsWith(';') ? header : `${header};`);
      continue;
    }

    // Class definition headers
    if (trimmed.startsWith('export class ') || trimmed.startsWith('class ')) {
      const header = trimmed.replace(/\{.*$/, '').trim();
      signatureLines.push(`${header} { ... }`);
      continue;
    }
  }

  return signatureLines.join('\n');
}

/**
 * Loads AST signature cache from .vibe/cache/ast-signatures.json
 */
export async function loadAstCache(cwd: string): Promise<AstSignatureCache> {
  const cachePath = path.join(cwd, '.vibe', 'cache', 'ast-signatures.json');
  if (await fs.pathExists(cachePath)) {
    try {
      return await fs.readJson(cachePath);
    } catch {
      // Fallback on corrupt cache
    }
  }
  return { version: 1, entries: {} };
}

/**
 * Saves AST signature cache to .vibe/cache/ast-signatures.json
 */
export async function saveAstCache(cwd: string, cache: AstSignatureCache): Promise<void> {
  const cacheDir = path.join(cwd, '.vibe', 'cache');
  await fs.ensureDir(cacheDir);
  await fs.writeJson(path.join(cacheDir, 'ast-signatures.json'), cache, { spaces: 2 });
}

/**
 * Parses error logs across Node/TS, Python, PHP, C# to extract stack frames.
 */
export function parseStackTraceFrames(logContent: string): Array<{ filePath: string; line: number }> {
  const frames: Array<{ filePath: string; line: number }> = [];
  const seen = new Set<string>();

  const lines = logContent.split(/\r?\n/);
  for (const line of lines) {
    // 1. Node / TypeScript: at ... (c:/path/file.ts:42:15) or at c:/path/file.ts:42:15
    const nodeMatch = line.match(/at (?:.*?\((.+?):(\d+):\d+\)|(.+?):(\d+):\d+)/);
    if (nodeMatch) {
      const filePath = (nodeMatch[1] || nodeMatch[3]).trim();
      const lineNum = parseInt(nodeMatch[2] || nodeMatch[4], 10);
      const key = `${filePath}:${lineNum}`;
      if (!seen.has(key) && !filePath.includes('node:internal') && !filePath.includes('node_modules')) {
        seen.add(key);
        frames.push({ filePath, line: lineNum });
      }
      continue;
    }

    // 2. Python: File "path/to/file.py", line 42, in ...
    const pyMatch = line.match(/File "([^"]+)", line (\d+)/);
    if (pyMatch) {
      const filePath = pyMatch[1].trim();
      const lineNum = parseInt(pyMatch[2], 10);
      const key = `${filePath}:${lineNum}`;
      if (!seen.has(key)) {
        seen.add(key);
        frames.push({ filePath, line: lineNum });
      }
      continue;
    }

    // 3. PHP: in /path/to/file.php on line 42 or .../file.php:42
    const phpMatch = line.match(/(?:in|at) ([^\s]+\.php)(?: on line |:)(\d+)/);
    if (phpMatch) {
      const filePath = phpMatch[1].trim();
      const lineNum = parseInt(phpMatch[2], 10);
      const key = `${filePath}:${lineNum}`;
      if (!seen.has(key) && !filePath.includes('vendor/')) {
        seen.add(key);
        frames.push({ filePath, line: lineNum });
      }
      continue;
    }

    // 4. C# / .NET: in C:\path\file.cs:line 42
    const csMatch = line.match(/in (.+?):line (\d+)/);
    if (csMatch) {
      const filePath = csMatch[1].trim();
      const lineNum = parseInt(csMatch[2], 10);
      const key = `${filePath}:${lineNum}`;
      if (!seen.has(key)) {
        seen.add(key);
        frames.push({ filePath, line: lineNum });
      }
    }
  }

  return frames;
}

/**
 * Slices +/- 20 lines around file:line frame.
 */
export async function sliceFileFrameContext(
  cwd: string,
  filePathInput: string,
  targetLine: number
): Promise<string | null> {
  let resolvedPath = path.isAbsolute(filePathInput) ? filePathInput : path.join(cwd, filePathInput);

  if (!(await fs.pathExists(resolvedPath))) {
    // Try resolving relative if absolute path came from a different container mount
    const basename = path.basename(filePathInput);
    resolvedPath = path.join(cwd, 'src', basename);
    if (!(await fs.pathExists(resolvedPath))) {
      return null;
    }
  }

  try {
    const content = await fs.readFile(resolvedPath, 'utf8');
    const lines = content.split(/\r?\n/);
    const start = Math.max(0, targetLine - 21);
    const end = Math.min(lines.length, targetLine + 20);

    const relPath = path.relative(cwd, resolvedPath).replace(/\\/g, '/');
    const snippetLines: string[] = [];
    snippetLines.push(`// --- Frame Context: ${relPath}:${targetLine} (Lines ${start + 1}-${end}) ---`);

    for (let i = start; i < end; i++) {
      const lineNo = i + 1;
      const marker = lineNo === targetLine ? '>>> ' : '    ';
      snippetLines.push(`${marker}${lineNo.toString().padStart(4, ' ')} | ${lines[i]}`);
    }

    return snippetLines.join('\n');
  } catch {
    return null;
  }
}

/**
 * Executes a git command safely returning stdout.
 */
function runGit(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn('git', args, { cwd });
    let stdout = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.on('close', () => resolve(stdout.trim()));
    child.on('error', () => resolve(''));
  });
}

/**
 * Builds a compact file tree representation.
 */
export async function buildCompactFileTree(cwd: string, maxDepth = 3): Promise<string> {
  const ignoreDirs = new Set(['node_modules', '.git', 'dist', 'build', '.vibe', '.vault', '.vault-global']);
  const lines: string[] = [];

  async function walk(dir: string, depth: number, prefix: string) {
    if (depth > maxDepth) return;
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (ignoreDirs.has(entry.name)) continue;
        if (entry.name.startsWith('.')) continue;

        if (entry.isDirectory()) {
          lines.push(`${prefix}${entry.name}/`);
          await walk(path.join(dir, entry.name), depth + 1, `${prefix}  `);
        } else {
          lines.push(`${prefix}${entry.name}`);
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  await walk(cwd, 1, '');
  return lines.slice(0, 50).join('\n');
}

/**
 * Assembles tiered context within strict budget constraints.
 */
export async function assembleTieredContext(
  cwd: string,
  options: {
    budget?: number;
    diff?: boolean;
    errorLog?: string;
    compress?: boolean;
    cached?: boolean;
    sourceFiles?: string[];
  } = {}
): Promise<TieredContextResult> {
  const budget = options.budget || 4000;
  const tier1Cap = Math.floor(budget * 0.5); // 50%
  const tier2Cap = Math.floor(budget * 0.3); // 30%
  const tier3Cap = Math.floor(budget * 0.2); // 20%

  // --- TIER 1: Active Diffs & Error Log Context (50%) ---
  let tier1Content = '';
  const diffOutput = await runGit(['diff', '--unified=3', 'HEAD'], cwd);
  if (diffOutput) {
    tier1Content += `### Git Diff (HEAD):\n\`\`\`diff\n${diffOutput}\n\`\`\`\n\n`;
  }

  if (options.errorLog && (await fs.pathExists(path.resolve(cwd, options.errorLog)))) {
    const errorLogRaw = await fs.readFile(path.resolve(cwd, options.errorLog), 'utf8');
    const frames = parseStackTraceFrames(errorLogRaw);
    if (frames.length > 0) {
      tier1Content += `### Parsed Error Frames Context:\n`;
      for (const frame of frames.slice(0, 5)) {
        const snippet = await sliceFileFrameContext(cwd, frame.filePath, frame.line);
        if (snippet) {
          tier1Content += `\`\`\`\n${snippet}\n\`\`\`\n\n`;
        }
      }
    }
  }

  if (options.compress) {
    tier1Content = compressContext(tier1Content);
  }

  let tier1Tokens = estimateTokens(tier1Content);
  if (tier1Tokens > tier1Cap) {
    // Truncate Tier 1
    const allowedChars = Math.floor(tier1Cap * 3.6);
    tier1Content = tier1Content.substring(0, allowedChars) + '\n\n... [Tier 1 Diff/Error truncated to fit 50% budget]';
    tier1Tokens = estimateTokens(tier1Content);
  }

  // --- TIER 2: AST Signatures with SHA-256 Cache (30%) ---
  let tier2Content = '';
  const cache = await loadAstCache(cwd);
  let cachedHits = 0;
  let cacheModified = false;

  const targetFiles = options.sourceFiles || [];
  const signatureBlocks: string[] = [];

  for (const relFile of targetFiles) {
    const absPath = path.resolve(cwd, relFile);
    if (!(await fs.pathExists(absPath))) continue;

    try {
      const rawCode = await fs.readFile(absPath, 'utf8');
      const hash = computeSha256(rawCode);

      let sig: string;
      if (options.cached !== false && cache.entries[hash]) {
        sig = cache.entries[hash].signature;
        cachedHits++;
      } else {
        sig = extractSignatures(rawCode);
        cache.entries[hash] = { signature: sig, updatedAt: new Date().toISOString() };
        cacheModified = true;
      }

      if (sig.trim()) {
        const ext = path.extname(relFile).replace('.', '') || 'ts';
        signatureBlocks.push(`### Signature: \`${relFile}\`\n\`\`\`${ext}\n${sig}\n\`\`\``);
      }
    } catch {
      // Ignore read errors
    }
  }

  if (cacheModified) {
    await saveAstCache(cwd, cache);
  }

  tier2Content = signatureBlocks.join('\n\n');
  if (options.compress) {
    tier2Content = compressContext(tier2Content);
  }

  let tier2Tokens = estimateTokens(tier2Content);
  if (tier2Tokens > tier2Cap) {
    const allowedChars = Math.floor(tier2Cap * 3.6);
    tier2Content = tier2Content.substring(0, allowedChars) + '\n\n... [Tier 2 AST Signatures truncated to fit 30% budget]';
    tier2Tokens = estimateTokens(tier2Content);
  }

  // --- TIER 3: File Tree & Core Agent Rules (20%) ---
  let tier3Content = '';
  const tree = await buildCompactFileTree(cwd);
  tier3Content += `### Project Structure:\n\`\`\`\n${tree}\n\`\`\`\n\n`;

  const agentsPath = path.join(cwd, 'AGENTS.md');
  if (await fs.pathExists(agentsPath)) {
    const agentsRaw = await fs.readFile(agentsPath, 'utf8');
    tier3Content += `### Core Agent Rules (AGENTS.md):\n${agentsRaw}\n`;
  }

  if (options.compress) {
    tier3Content = compressContext(tier3Content);
  }

  let tier3Tokens = estimateTokens(tier3Content);
  if (tier3Tokens > tier3Cap) {
    const allowedChars = Math.floor(tier3Cap * 3.6);
    tier3Content = tier3Content.substring(0, allowedChars) + '\n\n... [Tier 3 Rules/Tree truncated to fit 20% budget]';
    tier3Tokens = estimateTokens(tier3Content);
  }

  // --- Combine into Master Payload ---
  const fullPayload = [
    `# Budget-Capped Context Pack (${budget} tokens max)`,
    `> Generated: ${new Date().toISOString()} • Est. Tokens: ~${tier1Tokens + tier2Tokens + tier3Tokens} / ${budget}`,
    '',
    tier1Content ? `## Tier 1: Diff & Error Context (~${tier1Tokens} tokens)\n${tier1Content}` : '',
    tier2Content ? `## Tier 2: AST Signatures (~${tier2Tokens} tokens)\n${tier2Content}` : '',
    tier3Content ? `## Tier 3: Architecture & Rules (~${tier3Tokens} tokens)\n${tier3Content}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const totalTokens = estimateTokens(fullPayload);

  return {
    tier1: tier1Content,
    tier2: tier2Content,
    tier3: tier3Content,
    fullPayload,
    totalTokens,
    tier1Tokens,
    tier2Tokens,
    tier3Tokens,
    budget,
    cachedHitCount: cachedHits,
  };
}
