import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import {
  categorizeFile,
  extractExports,
  explainWorkspaceChanges,
  getKnownEnvVars,
} from '../src/commands/explain.js';

describe('Vibe Explain (AI Changes & Risk Digest)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-explain-'));
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  it('categorizes files correctly by path and extension', () => {
    expect(categorizeFile('src/auth.test.ts')).toBe('test');
    expect(categorizeFile('src/routes/api.ts')).toBe('api');
    expect(categorizeFile('src/components/Button.tsx')).toBe('component');
    expect(categorizeFile('package.json')).toBe('config');
    expect(categorizeFile('docs/README.md')).toBe('doc');
    expect(categorizeFile('src/utils/math.ts')).toBe('util');
    expect(categorizeFile('logo.png')).toBe('other');
  });

  it('extracts exported functions, classes, and types from source', () => {
    const code = `
export function calculateTax(amount: number) { return amount * 0.2; }
export async function fetchUser() {}
export class PaymentService {}
export const API_VERSION = 'v1';
export interface UserProfile {}
export type Status = 'active' | 'inactive';
function privateHelper() {}
`;
    const exports = extractExports(code);
    expect(exports).toContain('calculateTax');
    expect(exports).toContain('fetchUser');
    expect(exports).toContain('PaymentService');
    expect(exports).toContain('API_VERSION');
    expect(exports).toContain('UserProfile');
    expect(exports).toContain('Status');
    expect(exports).not.toContain('privateHelper');
  });

  it('reads known environment variables from .env.example', async () => {
    const envExample = path.join(tmpDir, '.env.example');
    fs.writeFileSync(envExample, 'PORT=3000\nDATABASE_URL=postgres://...\n# Comment\n', 'utf8');

    const vars = await getKnownEnvVars(tmpDir);
    expect(vars.has('PORT')).toBe(true);
    expect(vars.has('DATABASE_URL')).toBe(true);
    expect(vars.has('STRIPE_KEY')).toBe(false);
  });

  it('analyzes workspace diffs, detects new modules, and catches risk signals', async () => {
    // 1. Setup git repo
    spawnSync('git', ['init'], { cwd: tmpDir });
    spawnSync('git', ['config', 'user.name', 'ExplainTester'], { cwd: tmpDir });
    spawnSync('git', ['config', 'user.email', 'explain@vibe.dev'], { cwd: tmpDir });

    const pkgJson = path.join(tmpDir, 'package.json');
    fs.writeJsonSync(pkgJson, { name: 'test-app', dependencies: { react: '^18.0.0' } });

    const envEx = path.join(tmpDir, '.env.example');
    fs.writeFileSync(envEx, 'PORT=3000\n', 'utf8');

    spawnSync('git', ['add', '.'], { cwd: tmpDir });
    spawnSync('git', ['commit', '-m', 'initial commit'], { cwd: tmpDir });

    // 2. Simulate AI modifications:
    // a. Add new module with unconfigured env variable and dynamically assembled mock secret
    const mockSecret = ['sk', 'live', '123456789012345678901234'].join('_');
    const newRoute = path.join(tmpDir, 'auth.ts');
    fs.writeFileSync(
      newRoute,
      `export function login() {
  const secret = "${mockSecret}";
  const customVar = process.env.UNCONFIGURED_VAR;
  return secret;
}
`,
      'utf8'
    );

    // b. Modify package.json to add a new dependency
    fs.writeJsonSync(pkgJson, {
      name: 'test-app',
      dependencies: { react: '^18.0.0', stripe: '^14.0.0' },
    });

    // 3. Run explain analysis
    const explanation = await explainWorkspaceChanges(tmpDir);

    expect(explanation.hasChanges).toBe(true);
    expect(explanation.addedFiles.length).toBeGreaterThanOrEqual(1);

    const added = explanation.addedFiles.find((f) => f.path.includes('auth.ts'));
    expect(added).toBeDefined();
    expect(added?.exports).toContain('login');

    const mod = explanation.modifiedFiles.find((f) => f.path.includes('package.json'));
    expect(mod).toBeDefined();

    // 4. Verify risk radar flags
    const secretRisk = explanation.risks.find((r) => r.type === 'secret');
    expect(secretRisk).toBeDefined();
    expect(secretRisk?.severity).toBe('high');

    const envRisk = explanation.risks.find((r) => r.type === 'env');
    expect(envRisk).toBeDefined();
    expect(envRisk?.message).toContain('UNCONFIGURED_VAR');

    // 5. Verify markdown generation
    expect(explanation.markdown).toContain('Executive Summary');
    expect(explanation.markdown).toContain('🟢 Added Files');
    expect(explanation.markdown).toContain('🔴 Gotchas & Risks');
  });
});
