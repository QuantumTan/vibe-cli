import path from 'path';
import fs from 'fs-extra';
import { spawn } from 'child_process';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { createCheckpoint, listCheckpoints, restoreCheckpoint } from './checkpoint.js';

export interface WorkspaceFileChange {
  path: string;
  type: 'modified' | 'untracked' | 'added' | 'deleted' | 'renamed';
  staged: boolean;
  rawCode: string;
}

export interface WorkspaceStatus {
  isGitRepo: boolean;
  changes: WorkspaceFileChange[];
  totalChanged: number;
}

export interface RewindResult {
  success: boolean;
  revertedFiles: string[];
  autoBackupId?: string;
  restoredCheckpointId?: string;
  error?: string;
}

/**
 * Execute a git command in the target directory.
 */
export function runGit(args: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn('git', args, { cwd });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => resolve({ stdout, stderr: stderr.trim(), code: code ?? 1 }));
    child.on('error', (err) => resolve({ stdout: '', stderr: err.message, code: 1 }));
  });
}

/**
 * Inspects working tree changes (modified, untracked, added, deleted).
 */
export async function getWorkspaceStatus(cwd: string): Promise<WorkspaceStatus> {
  const { code, stdout } = await runGit(['status', '--porcelain'], cwd);
  if (code !== 0) {
    return { isGitRepo: false, changes: [], totalChanged: 0 };
  }

  // Split lines without trimming leading spaces (which denote untracked or unstaged flags)
  const lines = stdout.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const changes: WorkspaceFileChange[] = [];

  for (const line of lines) {
    // Git porcelain format: 2 chars of status, 1 space, then filename (or old -> new)
    const match = line.match(/^([ A-Z?]{2})\s+(.*)$/);
    if (!match) continue;

    const rawCode = match[1];
    const rest = match[2].trim();
    const filePath = rest.includes('->') ? rest.split('->')[1].trim() : rest;

    // Never treat Obsidian vault or git internal files as workspace changes
    const normalized = filePath.replace(/\\/g, '/');
    if (normalized === '.vault' || normalized.startsWith('.vault/') || normalized.startsWith('.git/')) {
      continue;
    }

    let type: WorkspaceFileChange['type'] = 'modified';
    let staged = false;

    if (rawCode === '??') {
      type = 'untracked';
    } else if (rawCode.includes('D')) {
      type = 'deleted';
      staged = rawCode[0] === 'D';
    } else if (rawCode.includes('A')) {
      type = 'added';
      staged = true;
    } else if (rawCode.includes('R')) {
      type = 'renamed';
      staged = true;
    } else if (rawCode.includes('M')) {
      type = 'modified';
      staged = rawCode[0] === 'M';
    }

    changes.push({ path: filePath, type, staged, rawCode });
  }

  return {
    isGitRepo: true,
    changes,
    totalChanged: changes.length,
  };
}

/**
 * Executes the rewind operation.
 */
export async function executeRewind(
  cwd: string,
  options: {
    files?: string[];
    hard?: boolean;
    checkpoint?: boolean;
    dryRun?: boolean;
    autoBackup?: boolean;
  } = {}
): Promise<RewindResult> {
  const status = await getWorkspaceStatus(cwd);

  if (options.checkpoint) {
    const checkpoints = await listCheckpoints(cwd);
    if (checkpoints.length === 0) {
      return { success: false, revertedFiles: [], error: 'No checkpoints found to rewind to.' };
    }
    const latest = checkpoints[0];
    if (options.dryRun) {
      return {
        success: true,
        revertedFiles: Object.keys(latest.files),
        restoredCheckpointId: latest.id,
      };
    }
    const res = await restoreCheckpoint(cwd, latest.id);
    return {
      success: res.success,
      revertedFiles: Object.keys(latest.files),
      restoredCheckpointId: latest.id,
      error: res.error,
    };
  }

  if (status.totalChanged === 0) {
    return { success: true, revertedFiles: [] };
  }

  const targets = options.files && options.files.length > 0
    ? status.changes.filter((c) => options.files!.includes(c.path))
    : status.changes;

  if (targets.length === 0) {
    return { success: true, revertedFiles: [] };
  }

  if (options.dryRun) {
    return {
      success: true,
      revertedFiles: targets.map((t) => t.path),
    };
  }

  // Safety net: Auto-backup current state so user never permanently loses wanted changes
  let autoBackupId: string | undefined;
  if (options.autoBackup !== false) {
    try {
      const backup = await createCheckpoint(cwd, 'Auto-backup before vibe rewind');
      autoBackupId = backup.id;
    } catch {
      // Non-fatal if backup fails
    }
  }

  const reverted: string[] = [];
  const trackedToRestore: string[] = [];
  const untrackedToRemove: string[] = [];

  for (const t of targets) {
    if (t.type === 'untracked') {
      untrackedToRemove.push(t.path);
    } else {
      trackedToRestore.push(t.path);
    }
  }

  // 1. Remove untracked files / directories created by AI
  for (const relPath of untrackedToRemove) {
    const absPath = path.join(cwd, relPath);
    try {
      if (await fs.pathExists(absPath)) {
        await fs.remove(absPath);
        reverted.push(relPath);
      }
    } catch {
      // Ignore cleanup error
    }
  }

  // 2. Restore tracked modified/staged/deleted files
  if (trackedToRestore.length > 0) {
    if (!options.files || options.files.length === 0) {
      // Restore everything tracked
      await runGit(['restore', '--staged', '.'], cwd);
      await runGit(['restore', '.'], cwd);
      // Fallback for older git versions
      await runGit(['checkout', 'HEAD', '--', '.'], cwd);
      reverted.push(...trackedToRestore);
    } else {
      // Restore specific tracked files
      await runGit(['restore', '--staged', '--', ...trackedToRestore], cwd);
      await runGit(['restore', '--', ...trackedToRestore], cwd);
      await runGit(['checkout', 'HEAD', '--', ...trackedToRestore], cwd);
      reverted.push(...trackedToRestore);
    }
  }

  // 3. Notify .vault/_Context.md if present
  const contextPath = path.join(cwd, '.vault', '_Context.md');
  if (await fs.pathExists(contextPath)) {
    try {
      const existing = await fs.readFile(contextPath, 'utf8');
      const timeStr = new Date().toLocaleTimeString();
      const rewindNote = `\n> ⚠️ **vibe rewind**: Discarded AI edits across ${reverted.length} file(s) on ${timeStr}.\n`;
      if (!existing.includes(rewindNote.trim())) {
        await fs.writeFile(contextPath, existing + rewindNote, 'utf8');
      }
    } catch {
      // Ignore non-critical context update
    }
  }

  return {
    success: true,
    revertedFiles: reverted,
    autoBackupId,
  };
}

/**
 * Interactive vibe rewind command.
 */
export async function rewindCommand(
  options: {
    hard?: boolean;
    checkpoint?: boolean;
    dryRun?: boolean;
  } = {}
): Promise<void> {
  const cwd = process.cwd();
  p.intro(pc.bgMagenta(pc.black(' vibe rewind ')) + ' ' + pc.bold('1-Click AI Undo / Workspace Panic Button'));

  const status = await getWorkspaceStatus(cwd);
  const checkpoints = await listCheckpoints(cwd);

  if (!status.isGitRepo) {
    p.log.warn('Current directory is not a Git repository.');
    if (checkpoints.length > 0) {
      const restoreCp = await p.confirm({
        message: `Found ${checkpoints.length} vibe checkpoint(s). Restore latest snapshot (${checkpoints[0].id})?`,
        initialValue: true,
      });
      if (restoreCp && !p.isCancel(restoreCp)) {
        const res = await restoreCheckpoint(cwd, checkpoints[0].id);
        if (res.success) {
          p.outro(pc.green(`Restored latest checkpoint ${checkpoints[0].id} (${res.restoredCount} files).`));
        } else {
          p.log.error(res.error || 'Failed to restore checkpoint.');
          p.outro('Rewind aborted.');
        }
      }
    } else {
      p.outro('Initialize git with `git init` or use `vibe checkpoint` for snapshotting.');
    }
    return;
  }

  if (options.checkpoint) {
    if (checkpoints.length === 0) {
      p.log.warn('No checkpoints found. Create one with `vibe checkpoint`.');
      p.outro('Done.');
      return;
    }
    const latest = checkpoints[0];
    const confirm = await p.confirm({
      message: `Rewind to latest checkpoint ${pc.cyan(latest.id)} ("${latest.label}")?`,
      initialValue: true,
    });
    if (p.isCancel(confirm) || !confirm) {
      p.cancel('Rewind canceled.');
      return;
    }
    const s = p.spinner();
    s.start('Restoring checkpoint...');
    const res = await executeRewind(cwd, { checkpoint: true });
    s.stop(pc.green(`Restored checkpoint ${latest.id}!`));
    p.outro('Workspace restored.');
    return;
  }

  if (status.totalChanged === 0) {
    p.log.info(pc.green('Workspace is completely clean! No uncommitted changes from AI agents.'));
    if (checkpoints.length > 0) {
      const wantCheckpoint = await p.confirm({
        message: `Working tree is clean, but ${checkpoints.length} checkpoint(s) exist. Revert to latest checkpoint (${checkpoints[0].id})?`,
        initialValue: false,
      });
      if (wantCheckpoint && !p.isCancel(wantCheckpoint)) {
        await executeRewind(cwd, { checkpoint: true });
        p.outro(pc.green(`Restored to checkpoint ${checkpoints[0].id}.`));
        return;
      }
    }
    p.outro('Nothing to rewind.');
    return;
  }

  // Display summary of changes
  const modifiedList = status.changes.filter((c) => c.type !== 'untracked');
  const untrackedList = status.changes.filter((c) => c.type === 'untracked');

  const fileLines: string[] = [];
  for (const ch of status.changes.slice(0, 15)) {
    const icon = ch.type === 'untracked' ? pc.green('+ [new]') : ch.type === 'deleted' ? pc.red('- [del]') : pc.yellow('~ [mod]');
    fileLines.push(`  ${icon} ${ch.path}`);
  }
  if (status.changes.length > 15) {
    fileLines.push(pc.dim(`  ... and ${status.changes.length - 15} more file(s)`));
  }

  p.note(
    `${pc.bold('Detected AI modifications in working tree:')}\n\n` +
      fileLines.join('\n') +
      `\n\n${pc.dim(`Total: ${modifiedList.length} modified, ${untrackedList.length} untracked`)}`,
    'Pending Changes'
  );

  if (options.dryRun) {
    p.log.info(pc.cyan(`[Dry Run] Would discard edits in ${status.totalChanged} file(s).`));
    p.outro('No files were modified.');
    return;
  }

  let action: string | symbol = 'all';

  if (!options.hard) {
    const choices = [
      {
        value: 'all',
        label: pc.bold('Discard all AI changes (Full Rewind)'),
        hint: 'Reset tracked files + delete untracked files created by AI',
      },
      {
        value: 'select',
        label: 'Select specific files to rewind',
        hint: 'Choose which files to discard and which to keep',
      },
    ];

    if (checkpoints.length > 0) {
      choices.push({
        value: 'checkpoint',
        label: `Restore latest checkpoint (${checkpoints[0].id})`,
        hint: checkpoints[0].label,
      });
    }

    choices.push({
      value: 'cancel',
      label: 'Cancel (keep everything as-is)',
      hint: 'Leave files untouched',
    });

    action = await p.select({
      message: 'Choose rewind strategy:',
      options: choices,
    });

    if (p.isCancel(action) || action === 'cancel') {
      p.cancel('Rewind canceled. Workspace unchanged.');
      return;
    }
  }

  let targetFiles: string[] | undefined;

  if (action === 'select') {
    const selected = await p.multiselect({
      message: 'Select files to DISCARD (space to toggle, enter to confirm):',
      options: status.changes.map((c) => ({
        value: c.path,
        label: c.path,
        hint: c.type,
      })),
      required: true,
    });

    if (p.isCancel(selected)) {
      p.cancel('Rewind canceled.');
      return;
    }

    targetFiles = selected as string[];
  }

  if (action === 'checkpoint') {
    const s = p.spinner();
    s.start('Restoring latest checkpoint...');
    const res = await executeRewind(cwd, { checkpoint: true });
    s.stop(pc.green(`Restored to checkpoint ${res.restoredCheckpointId}!`));
    p.outro('Workspace restored.');
    return;
  }

  const s = p.spinner();
  s.start('Rewinding workspace to clean state...');

  const result = await executeRewind(cwd, { files: targetFiles });

  s.stop(pc.green(`Rewind complete! Reverted ${result.revertedFiles.length} file(s).`));

  if (result.autoBackupId) {
    p.log.info(
      pc.dim(`Safety backup saved as checkpoint `) +
        pc.cyan(result.autoBackupId) +
        pc.dim(` (run \`vibe rollback ${result.autoBackupId}\` to restore).`)
    );
  }

  p.outro(pc.green('Workspace is clean again. Safe to continue vibe coding!'));
}
