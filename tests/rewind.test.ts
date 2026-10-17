import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { getWorkspaceStatus, executeRewind } from '../src/commands/rewind.js';
import { createCheckpoint } from '../src/commands/checkpoint.js';

describe('Vibe Rewind (AI Workspace Panic Button)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-rewind-'));
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  it('handles non-git directories gracefully', async () => {
    const status = await getWorkspaceStatus(tmpDir);
    expect(status.isGitRepo).toBe(false);
    expect(status.changes).toHaveLength(0);
    expect(status.totalChanged).toBe(0);
  });

  it('detects and reverts modified and untracked files in a git repo', async () => {
    // 1. Initialize temporary git repo
    spawnSync('git', ['init'], { cwd: tmpDir });
    spawnSync('git', ['config', 'user.name', 'VibeTester'], { cwd: tmpDir });
    spawnSync('git', ['config', 'user.email', 'test@vibe.dev'], { cwd: tmpDir });

    const initialFile = path.join(tmpDir, 'app.ts');
    fs.writeFileSync(initialFile, 'export const initial = true;\n', 'utf8');
    spawnSync('git', ['add', '.'], { cwd: tmpDir });
    spawnSync('git', ['commit', '-m', 'initial commit'], { cwd: tmpDir });

    // 2. Simulate AI modifications (edit tracked file + add rogue untracked file)
    fs.writeFileSync(initialFile, 'export const brokenByAI = true;\n', 'utf8');
    const rogueFile = path.join(tmpDir, 'rogue-ai-output.ts');
    fs.writeFileSync(rogueFile, 'console.log("hallucinated code");\n', 'utf8');

    // 3. Inspect status
    const status = await getWorkspaceStatus(tmpDir);
    expect(status.isGitRepo).toBe(true);
    expect(status.totalChanged).toBe(2);

    const hasModified = status.changes.some((c) => c.path === 'app.ts' && c.type === 'modified');
    const hasUntracked = status.changes.some((c) => c.path.includes('rogue-ai-output') && c.type === 'untracked');
    expect(hasModified).toBe(true);
    expect(hasUntracked).toBe(true);

    // 4. Test Dry Run mode
    const dryRunResult = await executeRewind(tmpDir, { dryRun: true });
    expect(dryRunResult.success).toBe(true);
    expect(dryRunResult.revertedFiles).toHaveLength(2);
    // Files should NOT have been touched yet
    expect(fs.existsSync(rogueFile)).toBe(true);

    // 5. Test Full Rewind with autoBackup
    const result = await executeRewind(tmpDir, { autoBackup: true });
    expect(result.success).toBe(true);
    expect(result.revertedFiles.length).toBeGreaterThanOrEqual(1);

    // Untracked rogue file should be deleted
    expect(fs.existsSync(rogueFile)).toBe(false);
    // Tracked file should be reverted to clean initial state
    const restoredContent = fs.readFileSync(initialFile, 'utf8').replace(/\r\n/g, '\n');
    expect(restoredContent).toBe('export const initial = true;\n');

    // Workspace should now be completely clean
    const postStatus = await getWorkspaceStatus(tmpDir);
    expect(postStatus.totalChanged).toBe(0);

    // Auto-backup checkpoint should exist
    expect(result.autoBackupId).toBeDefined();
    const backupManifest = path.join(tmpDir, '.vault', 'Checkpoints', result.autoBackupId!, 'manifest.json');
    expect(fs.existsSync(backupManifest)).toBe(true);
  });

  it('restores checkpoint snapshot when checkpoint flag is passed', async () => {
    const fileA = path.join(tmpDir, 'package.json');
    fs.writeJsonSync(fileA, { state: 'good' });

    // Create a manual checkpoint
    const cp = await createCheckpoint(tmpDir, 'Working baseline');

    // Break the file
    fs.writeJsonSync(fileA, { state: 'broken_by_agent' });

    // Rewind with checkpoint option
    const result = await executeRewind(tmpDir, { checkpoint: true });
    expect(result.success).toBe(true);
    expect(result.restoredCheckpointId).toBe(cp.id);

    const restoredJson = fs.readJsonSync(fileA);
    expect(restoredJson.state).toBe('good');
  });
});
