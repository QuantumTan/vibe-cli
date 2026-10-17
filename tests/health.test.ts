import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import {
  findOversizedFiles,
  evaluateVibeHealth,
  executeAutoFix,
} from '../src/commands/health.js';

describe('Vibe Health (AI Readiness Score & Diagnostics)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-health-'));
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  it('detects oversized source files and ignores node_modules and .vault', async () => {
    const srcDir = path.join(tmpDir, 'src');
    fs.ensureDirSync(srcDir);

    // Create a 25-line file with threshold 20
    const bigFile = path.join(srcDir, 'huge.ts');
    fs.writeFileSync(bigFile, Array(25).fill('export const x = 1;').join('\n'), 'utf8');

    // Create a file in node_modules (should be ignored)
    const nmDir = path.join(tmpDir, 'node_modules', 'dep');
    fs.ensureDirSync(nmDir);
    fs.writeFileSync(path.join(nmDir, 'index.js'), Array(100).fill('// comment').join('\n'), 'utf8');

    const oversized = await findOversizedFiles(tmpDir, 20);
    expect(oversized).toHaveLength(1);
    expect(oversized[0].path).toBe('src/huge.ts');
    expect(oversized[0].lines).toBe(25);
  });

  it('evaluates health of an unlinked project and flags missing memory components', async () => {
    const report = await evaluateVibeHealth(tmpDir);

    expect(report.totalScore).toBeLessThan(60);
    expect(['C', 'Needs Work']).toContain(report.grade);

    const contextCheck = report.checks.find((c) => c.id === 'context_exists');
    expect(contextCheck?.status).toBe('fail');

    const junctionCheck = report.checks.find((c) => c.id === 'junction_alive');
    expect(junctionCheck?.status).toBe('fail');
  });

  it('gives high score when memory bank, context hub, and AGENTS.md are configured', async () => {
    // 1. Setup .vault directory with _Context.md and Lessons-and-Gotchas.md
    const vaultDir = path.join(tmpDir, '.vault');
    const memoryDir = path.join(vaultDir, 'Memory-Bank');
    fs.ensureDirSync(memoryDir);

    const contextPath = path.join(vaultDir, '_Context.md');
    fs.writeFileSync(
      contextPath,
      '---\ntitle: test-app\n---\n# test-app\n\n## Current Objective\n- Vibe coding.\n\n## Active Tasks\n- [ ] Task 1\n',
      'utf8'
    );

    const lessonsPath = path.join(memoryDir, 'Lessons-and-Gotchas.md');
    fs.writeFileSync(lessonsPath, '# Lessons\n- [10/17/2026] Clean architecture wins.\n', 'utf8');

    // 2. Setup AGENTS.md
    const agentsPath = path.join(tmpDir, 'AGENTS.md');
    fs.writeFileSync(agentsPath, '# Agent Directives\nStrict rules.\n', 'utf8');

    // 3. Evaluate health
    const report = await evaluateVibeHealth(tmpDir);

    expect(report.totalScore).toBeGreaterThanOrEqual(65);

    const contextCheck = report.checks.find((c) => c.id === 'context_exists');
    expect(contextCheck?.status).toBe('pass');

    const densityCheck = report.checks.find((c) => c.id === 'context_length');
    expect(densityCheck?.status).toBe('pass');

    const lessonsCheck = report.checks.find((c) => c.id === 'memory_lessons');
    expect(lessonsCheck?.status).toBe('pass');

    const agentsCheck = report.checks.find((c) => c.id === 'agents_md');
    expect(agentsCheck?.status).toBe('pass');
  });

  it('auto-repairs missing AGENTS.md and scaffolds .env.example', async () => {
    // Create an un-templated .env
    fs.writeFileSync(path.join(tmpDir, '.env'), 'SECRET_KEY=supersecret123\nDATABASE_URL=postgres://\n', 'utf8');

    const fixes = await executeAutoFix(tmpDir);
    expect(fixes.length).toBeGreaterThanOrEqual(2);

    // Verify AGENTS.md was created
    expect(fs.existsSync(path.join(tmpDir, 'AGENTS.md'))).toBe(true);

    // Verify .env.example was created with sanitized values
    const envExPath = path.join(tmpDir, '.env.example');
    expect(fs.existsSync(envExPath)).toBe(true);
    const envExContent = fs.readFileSync(envExPath, 'utf8');
    expect(envExContent).toContain('SECRET_KEY=your_secret_key_here');
  });
});
