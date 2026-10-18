import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import {
  parseContextData,
  parseLessonsData,
  generateRuleFiles,
  rulesCommand,
} from '../src/commands/rules.js';

describe('Vibe Rules (Universal Cross-Agent Rules & Prompt Cache Architect)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-rules-'));
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  it('parses _Context.md data into structured objectives and tasks', () => {
    const contextFile = path.join(tmpDir, '_Context.md');
    fs.writeFileSync(
      contextFile,
      `---
title: TestApp
stack:
  - TypeScript
  - React
category: Web App
---
# TestApp

## Current Objective
Build the authentication module with OAuth2.

## Active Tasks (Sliding Window)
- [ ] Setup OAuth provider
- [x] Configure environment variables
`,
      'utf-8'
    );

    const data = parseContextData(contextFile);
    expect(data.title).toBe('TestApp');
    expect(data.stack).toContain('TypeScript');
    expect(data.category).toBe('Web App');
    expect(data.objective).toContain('Build the authentication module with OAuth2.');
    expect(data.activeTasks).toHaveLength(2);
    expect(data.activeTasks[0]).toBe('- [ ] Setup OAuth provider');
  });

  it('parses Lessons-and-Gotchas.md and returns the latest entries', () => {
    const lessonsFile = path.join(tmpDir, 'Lessons.md');
    fs.writeFileSync(
      lessonsFile,
      `# Lessons
- [2026-10-10 12:00:00] Fixed JWT clock skew issue by adding 5s leeway
- [2026-10-11 14:00:00] Use HTTPS tunnel for Stripe webhook validation
- [2026-10-12 16:00:00] Avoid broad CSS reset in nested components
`,
      'utf-8'
    );

    const lessons = parseLessonsData(lessonsFile, 2);
    expect(lessons).toHaveLength(2);
    expect(lessons[0]).toContain('Use HTTPS tunnel');
    expect(lessons[1]).toContain('Avoid broad CSS reset');
  });

  it('generates multi-target agent rule files with glob-scoping and prompt-cache ordering', async () => {
    const vaultDir = path.join(tmpDir, '.vault');
    const memoryDir = path.join(vaultDir, 'Memory-Bank');
    fs.ensureDirSync(memoryDir);

    fs.writeFileSync(
      path.join(vaultDir, '_Context.md'),
      `---
title: SoloProject
category: Web App
---
## Current Objective
Build responsive UI for student portfolio.

## Active Tasks
- [ ] Build landing page
`,
      'utf-8'
    );

    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'solo-project',
        dependencies: { react: '^18.0.0', typescript: '^5.0.0' },
        scripts: { build: 'tsc && vite build', dev: 'vite' },
      }),
      'utf-8'
    );

    const ruleDefs = await generateRuleFiles(tmpDir);

    expect(ruleDefs.length).toBeGreaterThanOrEqual(6);

    const cursorContext = ruleDefs.find((r) => r.filePath.includes('00-context.mdc'));
    expect(cursorContext).toBeDefined();
    expect(cursorContext?.content).toContain('globs: *');
    expect(cursorContext?.content).toContain('Build responsive UI');

    const cursorStack = ruleDefs.find((r) => r.filePath.includes('20-stack.mdc'));
    expect(cursorStack).toBeDefined();
    expect(cursorStack?.content).toContain('globs: **/*.{ts,tsx,js,jsx}');

    const claudeMd = ruleDefs.find((r) => r.target === 'claude');
    expect(claudeMd).toBeDefined();
    expect(claudeMd?.content).toContain('# Claude Code Project Instructions');
    expect(claudeMd?.content).toContain('Build');

    const windsurf = ruleDefs.find((r) => r.target === 'windsurf');
    expect(windsurf).toBeDefined();
    expect(windsurf?.content).toContain('Windsurf Cascade Rules');

    const copilot = ruleDefs.find((r) => r.target === 'copilot');
    expect(copilot).toBeDefined();
    expect(copilot?.content).toContain('GitHub Copilot Project Guidelines');

    const agents = ruleDefs.find((r) => r.target === 'agents');
    expect(agents).toBeDefined();
    expect(agents?.content).toContain('Agent Guidelines & Memory Sync');
  });

  it('synchronizes rule files to disk when rulesCommand is executed', async () => {
    const origCwd = process.cwd();
    try {
      process.chdir(tmpDir);

      const vaultDir = path.join(tmpDir, '.vault');
      fs.ensureDirSync(vaultDir);
      fs.writeFileSync(
        path.join(vaultDir, '_Context.md'),
        '## Current Objective\nTest Sync\n## Active Tasks\n- [ ] Task 1',
        'utf-8'
      );

      await rulesCommand('sync');

      expect(fs.existsSync(path.join(tmpDir, '.cursor', 'rules', '00-context.mdc'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, '.cursor', 'rules', '10-lessons.mdc'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, '.cursor', 'rules', '20-stack.mdc'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, 'CLAUDE.md'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, '.windsurfrules'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, '.github', 'copilot-instructions.md'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, 'AGENTS.md'))).toBe(true);
    } finally {
      process.chdir(origCwd);
    }
  });
});
