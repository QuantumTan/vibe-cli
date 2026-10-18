import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import os from 'node:os';
import {
  parseSearchReplaceBlocks,
  applySearchReplace,
  truncateCompilerError,
  decomposeTask,
  executeVerifyLoop,
} from '../src/core/verify-loop.js';
import { estimateTokens } from '../src/utils/token-estimator.js';

describe('Small-Model Verification Loops & Search-Replace Guardrails', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vibe-verify-test-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('parses <<<< SEARCH / ==== / >>>> REPLACE diff blocks accurately', () => {
    const raw = `
Here is the fix for your issue:
<<<< SEARCH
const timeout = 1000;
====
const timeout = 5000;
>>>> REPLACE
`;
    const blocks = parseSearchReplaceBlocks(raw);
    expect(blocks.length).toBe(1);
    expect(blocks[0].search.trim()).toBe('const timeout = 1000;');
    expect(blocks[0].replace.trim()).toBe('const timeout = 5000;');
  });

  it('applies search-replace modification cleanly', () => {
    const original = `function greet() {\n  return "hello";\n}`;
    const blocks = [
      {
        search: 'return "hello";',
        replace: 'return "hello world";',
      },
    ];

    const result = applySearchReplace(original, blocks);
    expect(result.success).toBe(true);
    expect(result.updatedContent).toContain('return "hello world";');
  });

  it('fails gracefully when search target is missing from file', () => {
    const original = `function add(a, b) { return a + b; }`;
    const blocks = [
      {
        search: 'function subtract(a, b)',
        replace: 'function subtract(a, b) { return a - b; }',
      },
    ];

    const result = applySearchReplace(original, blocks);
    expect(result.success).toBe(false);
    expect(result.error).toContain('search block not found');
  });

  it('truncates verbose compiler errors to under 300 tokens', () => {
    const longCompilerOutput = `
> app@1.0.0 build
> tsc --noEmit

src/routes/auth.ts:45:10 - error TS2322: Type 'string' is not assignable to type 'number'.
  45   const id: number = req.params.id;
             ~~
src/routes/auth.ts:50:18 - error TS2339: Property 'role' does not exist on type 'UserSession'.
  50   if (session.user.role === 'admin') {
                        ~~~~
` + '\n'.repeat(50) + 'npm ERR! Lifecycle script failed.\n';

    const truncated = truncateCompilerError(longCompilerOutput, 300);
    const tokens = estimateTokens(truncated);

    expect(tokens).toBeLessThanOrEqual(300);
    expect(truncated).toContain('error TS2322');
    expect(truncated).toContain('error TS2339');
    expect(truncated).not.toContain('npm ERR!');
  });

  it('decomposes tasks into single-file atomic micro-steps', () => {
    const steps = decomposeTask('Implement user session expiration', [
      'src/auth.ts',
      'src/session.ts',
      'src/db.ts',
    ]);

    expect(steps.length).toBe(3);
    expect(steps[0].file).toBe('src/auth.ts');
    expect(steps[1].file).toBe('src/session.ts');
  });

  it('reverts workspace to pre-edit checkpoint if verification fails after retries', async () => {
    const srcDir = path.join(tmpDir, 'src');
    await fs.ensureDir(srcDir);
    const targetFile = path.join(srcDir, 'index.ts');
    const originalCode = 'export const VERSION = "1.0.0";\n';
    await fs.writeFile(targetFile, originalCode, 'utf8');

    // Introduce patch with syntax error verified by failing command
    const patch = `
<<<< SEARCH
export const VERSION = "1.0.0";
====
export const VERSION = INVALID SYNTAX;
>>>> REPLACE
`;

    // Verification command that always fails
    const failingVerifyCmd = 'node -e "process.exit(1)"';

    const result = await executeVerifyLoop(
      tmpDir,
      'src/index.ts',
      patch,
      failingVerifyCmd
    );

    expect(result.success).toBe(false);
    expect(result.reverted).toBe(true);

    // File should be restored to original clean state
    const currentCode = await fs.readFile(targetFile, 'utf8');
    expect(currentCode).toBe(originalCode);
  });
});
