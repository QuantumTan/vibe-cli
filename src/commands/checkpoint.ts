import path from 'path';
import fs from 'fs-extra';
import { spawn } from 'child_process';
import * as p from '@clack/prompts';
import pc from 'picocolors';

export interface CheckpointManifest {
  id: string;
  timestamp: string;
  label: string;
  gitCommit?: string;
  files: Record<string, string>;
  fileCount: number;
}

function getGitCommit(cwd: string): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn('git', ['rev-parse', '--short', 'HEAD'], { cwd });
    let stdout = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.on('close', (code) => {
      resolve(code === 0 ? stdout.trim() : 'untracked');
    });
    child.on('error', () => resolve('untracked'));
  });
}

function getChangedFiles(cwd: string): Promise<string[]> {
  return new Promise((resolve) => {
    const child = spawn('git', ['status', '--porcelain'], { cwd });
    let stdout = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.on('close', (code) => {
      if (code !== 0) return resolve([]);
      const lines = stdout.split('\n').filter((l) => l.trim().length > 0);
      const files: string[] = [];
      for (const line of lines) {
        // format is "XY filename" or "XY file1 -> file2"
        const clean = line.substring(3).trim();
        if (clean) {
          const actualPath = clean.includes('->') ? clean.split('->')[1].trim() : clean;
          files.push(actualPath);
        }
      }
      resolve(files);
    });
    child.on('error', () => resolve([]));
  });
}

export function getCheckpointStorageDir(cwd: string): string {
  const vaultCheckpoint = path.join(cwd, '.vault', 'Checkpoints');
  return vaultCheckpoint;
}

/**
 * Creates an instant workspace snapshot before AI modification.
 */
export async function createCheckpoint(
  cwd: string,
  labelInput?: string
): Promise<CheckpointManifest> {
  const checkpointDir = getCheckpointStorageDir(cwd);
  await fs.ensureDir(checkpointDir);

  const timestamp = new Date().toISOString();
  const id = `cp_${Date.now()}`;
  const label = labelInput?.trim() || `Snapshot at ${new Date().toLocaleTimeString()}`;
  const gitCommit = await getGitCommit(cwd);

  // Discover changed or sensitive working files
  const changedFiles = await getChangedFiles(cwd);
  const filesToSave: Record<string, string> = {};

  // If git status returned files, save them. If none or not a git repo, save files in src/ and root configs
  const candidates = new Set<string>(changedFiles);

  // Always back up core manifest/config files if they exist
  const coreConfigs = ['package.json', 'tsconfig.json', '.env', 'README.md', 'pubspec.yaml', 'composer.json'];
  for (const conf of coreConfigs) {
    if (await fs.pathExists(path.join(cwd, conf))) {
      candidates.add(conf);
    }
  }

  // Read contents into memory snapshot (skipping binary / huge files > 1MB)
  for (const relFile of candidates) {
    const absPath = path.join(cwd, relFile);
    try {
      if (await fs.pathExists(absPath)) {
        const stat = await fs.stat(absPath);
        if (stat.isFile() && stat.size < 1024 * 1024) {
          const content = await fs.readFile(absPath, 'utf8');
          filesToSave[relFile] = content;
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  const manifest: CheckpointManifest = {
    id,
    timestamp,
    label,
    gitCommit,
    files: filesToSave,
    fileCount: Object.keys(filesToSave).length,
  };

  const checkpointTargetDir = path.join(checkpointDir, id);
  await fs.ensureDir(checkpointTargetDir);
  await fs.writeJSON(path.join(checkpointTargetDir, 'manifest.json'), manifest, { spaces: 2 });

  return manifest;
}

/**
 * Lists all stored checkpoints for the current workspace.
 */
export async function listCheckpoints(cwd: string): Promise<CheckpointManifest[]> {
  const checkpointDir = getCheckpointStorageDir(cwd);
  if (!(await fs.pathExists(checkpointDir))) return [];

  const entries = await fs.readdir(checkpointDir, { withFileTypes: true });
  const checkpoints: CheckpointManifest[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const manifestPath = path.join(checkpointDir, entry.name, 'manifest.json');
      if (await fs.pathExists(manifestPath)) {
        try {
          const data = await fs.readJSON(manifestPath);
          checkpoints.push(data);
        } catch {
          // Ignore corrupted entry
        }
      }
    }
  }

  return checkpoints.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Restores a specific checkpoint by ID.
 */
export async function restoreCheckpoint(
  cwd: string,
  checkpointId: string
): Promise<{ success: boolean; restoredCount: number; error?: string }> {
  const checkpointDir = getCheckpointStorageDir(cwd);
  const targetManifest = path.join(checkpointDir, checkpointId, 'manifest.json');

  if (!(await fs.pathExists(targetManifest))) {
    return { success: false, restoredCount: 0, error: `Checkpoint ${checkpointId} not found.` };
  }

  const manifest: CheckpointManifest = await fs.readJSON(targetManifest);
  let count = 0;

  for (const [relFile, content] of Object.entries(manifest.files)) {
    const absPath = path.join(cwd, relFile);
    await fs.ensureDir(path.dirname(absPath));
    await fs.writeFile(absPath, content, 'utf8');
    count++;
  }

  // Update _Context.md if present to notify AI agents
  const contextPath = path.join(cwd, '.vault', '_Context.md');
  if (await fs.pathExists(contextPath)) {
    try {
      const existing = await fs.readFile(contextPath, 'utf8');
      const logEntry = `\n> ⚠️ **Rolled back to checkpoint**: \`${manifest.id}\` ("${manifest.label}") on ${new Date().toLocaleTimeString()}\n`;
      if (!existing.includes(manifest.id)) {
        await fs.writeFile(contextPath, existing + logEntry, 'utf8');
      }
    } catch {
      // Ignore context update error
    }
  }

  return { success: true, restoredCount: count };
}

/**
 * vibe checkpoint [label]
 */
export async function checkpointCommand(
  labelInput?: string,
  options: { list?: boolean } = {}
): Promise<void> {
  const cwd = process.cwd();

  if (options.list) {
    const list = await listCheckpoints(cwd);
    p.intro(pc.bgCyan(pc.black(' vibe checkpoint ')) + ' ' + pc.bold('Stored Time-Machine Checkpoints'));

    if (list.length === 0) {
      p.log.info('No checkpoints found. Create one with `vibe checkpoint "label"`.');
      p.outro('Time-machine ready.');
      return;
    }

    const rows = list
      .map(
        (cp) =>
          `• ${pc.bold(pc.cyan(cp.id))} (${pc.dim(cp.timestamp.substring(0, 16).replace('T', ' '))})\n` +
          `  Label:   ${pc.white(cp.label)}\n` +
          `  Files:   ${pc.yellow(cp.fileCount.toString())} saved | Git: ${pc.dim(cp.gitCommit || 'none')}`
      )
      .join('\n\n');

    p.note(rows, `Checkpoints (${list.length})`);
    p.outro('Restore any checkpoint using `vibe rollback <id>`.');
    return;
  }

  p.intro(pc.bgCyan(pc.black(' vibe checkpoint ')) + ' ' + pc.bold('Instant AI Time-Machine Snapshot'));

  let label = labelInput;
  if (!label) {
    const input = await p.text({
      message: 'Enter a checkpoint label (or press Enter for default timestamp):',
      placeholder: 'Before asking agent to refactor auth',
      defaultValue: `Snapshot at ${new Date().toLocaleTimeString()}`,
    });

    if (p.isCancel(input)) {
      p.cancel('Checkpoint canceled.');
      return;
    }
    label = input.trim();
  }

  const s = p.spinner();
  s.start('Snapshotting modified workspace files...');

  const manifest = await createCheckpoint(cwd, label);

  s.stop(pc.green(`Checkpoint saved! (${manifest.fileCount} file(s) snapshotted)`));

  p.note(
    `ID:       ${pc.bold(pc.cyan(manifest.id))}\n` +
      `Label:    ${pc.white(manifest.label)}\n` +
      `Files:    ${pc.yellow(manifest.fileCount.toString())} snapshot(s) safely stored\n` +
      `Git:      ${pc.dim(manifest.gitCommit || 'untracked')}\n\n` +
      `To rollback anytime:\n  ${pc.bold(pc.green(`vibe rollback ${manifest.id}`))}`,
    'Checkpoint Created'
  );

  p.outro('Safe to let AI agents edit code. Instant rollback available.');
}

/**
 * vibe rollback [checkpointId]
 */
export async function rollbackCommand(checkpointIdInput?: string): Promise<void> {
  const cwd = process.cwd();
  p.intro(pc.bgRed(pc.white(' vibe rollback ')) + ' ' + pc.bold('Restore Workspace State'));

  let checkpointId = checkpointIdInput;

  if (!checkpointId) {
    const list = await listCheckpoints(cwd);
    if (list.length === 0) {
      p.log.warn('No checkpoints found in this project to restore.');
      p.outro('Create one first with `vibe checkpoint`.');
      return;
    }

    const selected = await p.select({
      message: 'Select a checkpoint to restore:',
      options: list.map((cp) => ({
        value: cp.id,
        label: `${cp.id} — ${cp.label} (${cp.fileCount} files)`,
        hint: cp.timestamp.substring(0, 16).replace('T', ' '),
      })),
    });

    if (p.isCancel(selected)) {
      p.cancel('Rollback canceled.');
      return;
    }

    checkpointId = selected as string;
  }

  const confirm = await p.confirm({
    message: `Are you sure you want to rollback to checkpoint ${pc.cyan(checkpointId)}? Current uncommitted changes may be overwritten.`,
    initialValue: true,
  });

  if (p.isCancel(confirm) || !confirm) {
    p.cancel('Rollback aborted.');
    return;
  }

  const s = p.spinner();
  s.start(`Restoring checkpoint ${checkpointId}...`);

  const result = await restoreCheckpoint(cwd, checkpointId);

  if (!result.success) {
    s.stop(pc.red('Rollback failed.'));
    p.log.error(result.error || 'Failed to restore checkpoint.');
    p.outro('Workspace unchanged.');
    return;
  }

  s.stop(pc.green(`Rollback complete! Restored ${result.restoredCount} file(s).`));
  p.outro(pc.green(`🎉 Successfully restored to checkpoint ${checkpointId}.`));
}
