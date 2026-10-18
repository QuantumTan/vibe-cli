import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import os from 'node:os';
import {
  computeSha256,
  compressContext,
  extractSignatures,
  parseStackTraceFrames,
  sliceFileFrameContext,
  assembleTieredContext,
} from '../src/core/ast-packer.js';
import { estimateCodeTokens, estimateTokens } from '../src/utils/token-estimator.js';

describe('Zero-Budget Token Estimator & AST Context Packer', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vibe-pack-test-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('estimates code tokens using 3.6 chars/token + punctuation heuristic', () => {
    const codeSnippet = 'const sum = (a: number, b: number): number => { return a + b; };';
    const tokens = estimateCodeTokens(codeSnippet);
    expect(tokens).toBeGreaterThan(15);
    expect(tokens).toBeLessThan(35);
  });

  it('computes deterministic SHA-256 digests for cache keys', () => {
    const content = 'export const API_BASE = "https://api.vibe.dev";';
    const hash1 = computeSha256(content);
    const hash2 = computeSha256(content);
    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
  });

  it('extracts signatures and interfaces while stripping function bodies', () => {
    const tsCode = `
import { Config } from './config';
export interface UserPayload {
  id: string;
  email: string;
}
export type Status = 'active' | 'pending';

export async function processUser(payload: UserPayload): Promise<boolean> {
  const verified = await verify(payload);
  return verified;
}

export class UserService {
  private db: Database;
  constructor(db: Database) {
    this.db = db;
  }
}
`;
    const sigs = extractSignatures(tsCode);
    expect(sigs).toContain('export interface UserPayload');
    expect(sigs).toContain('export type Status');
    expect(sigs).toContain('export async function processUser(payload: UserPayload): Promise<boolean>;');
    expect(sigs).toContain('export class UserService { ... }');
    expect(sigs).not.toContain('const verified = await verify');
  });

  it('compresses context by removing comments and collapsing blank lines', () => {
    const messy = `
// First line comment
/* Multi-line
   block
   comment */
export const PORT = 3000;


// Middle comment

export const HOST = 'localhost';
`;
    const compressed = compressContext(messy);
    expect(compressed).not.toContain('First line comment');
    expect(compressed).not.toContain('Multi-line');
    expect(compressed).toContain("export const PORT = 3000;\n\nexport const HOST = 'localhost';");
  });

  it('parses error frames across Node/TS, Python, PHP, and C# stack traces', () => {
    const log = `
Error: Request failed
    at UserController.login (c:/projects/app/src/user.ts:42:15)
    at Layer.handle (c:/projects/app/node_modules/express/lib/router/layer.js:95:5)
File "/var/app/backend/models.py", line 88, in fetch_user
    raise DatabaseError("connection lost")
PHP Fatal error: in /var/www/html/auth.php on line 105
Unhandled exception in C:\\services\\Worker.cs:line 64
`;
    const frames = parseStackTraceFrames(log);
    expect(frames.length).toBe(4);

    expect(frames[0].filePath).toContain('user.ts');
    expect(frames[0].line).toBe(42);

    expect(frames[1].filePath).toContain('models.py');
    expect(frames[1].line).toBe(88);

    expect(frames[2].filePath).toContain('auth.php');
    expect(frames[2].line).toBe(105);

    expect(frames[3].filePath).toContain('Worker.cs');
    expect(frames[3].line).toBe(64);
  });

  it('slices +/- 20 lines around error frame with pointer indicator', async () => {
    const srcDir = path.join(tmpDir, 'src');
    await fs.ensureDir(srcDir);
    const testFile = path.join(srcDir, 'handler.ts');

    const lines: string[] = [];
    for (let i = 1; i <= 60; i++) {
      lines.push(`const line_${i} = ${i};`);
    }
    await fs.writeFile(testFile, lines.join('\n'), 'utf8');

    const slice = await sliceFileFrameContext(tmpDir, 'src/handler.ts', 30);
    expect(slice).not.toBeNull();
    expect(slice).toContain('>>>   30 | const line_30 = 30;');
    expect(slice).toContain('Frame Context: src/handler.ts:30');
  });

  it('assembles tiered context adhering to budget caps (50% / 30% / 20%)', async () => {
    const srcDir = path.join(tmpDir, 'src');
    await fs.ensureDir(srcDir);
    const fileA = path.join(srcDir, 'alpha.ts');
    await fs.writeFile(fileA, 'export function alpha(): string { return "alpha"; }', 'utf8');

    const result = await assembleTieredContext(tmpDir, {
      budget: 2000,
      diff: false,
      sourceFiles: ['src/alpha.ts'],
    });

    expect(result.budget).toBe(2000);
    expect(result.totalTokens).toBeLessThanOrEqual(2000);
    expect(result.tier2Tokens).toBeLessThanOrEqual(600); // 30% of 2000
    expect(result.tier3Tokens).toBeLessThanOrEqual(400); // 20% of 2000
    expect(result.fullPayload).toContain('Tier 2: AST Signatures');
  });
});
