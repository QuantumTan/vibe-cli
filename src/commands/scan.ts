import path from 'path';
import fs from 'fs-extra';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { loadConfig, getVaultPath, registerVault } from '../config.js';
import { inspectProject } from '../inspector.js';
import { openWindowsFolderPicker } from '../gui-picker.js';
import { linkProjectPipeline } from './link.js';
import { promptOrSelectVault } from './vault.js';
import type { ProjectMetadata } from '../types.js';

export interface ScanOptions {
  browse?: boolean;
  all?: boolean;
  vault?: string;
  force?: boolean;
}

export async function scanCommand(rootDir?: string, options: ScanOptions = {}): Promise<void> {
  const config = loadConfig();
  let targetDir = rootDir ? path.resolve(rootDir) : config.projectsRoot;

  if (options.browse) {
    const chosen = await openWindowsFolderPicker('Select Directory to Scan for Projects', targetDir);
    if (!chosen) {
      p.cancel('Scan canceled.');
      return;
    }
    targetDir = chosen;
  }

  p.intro(pc.bgMagenta(pc.black(' vibe scan ')) + ' ' + pc.bold(`Bulk Project Discovery in ${pc.dim(targetDir)}`));

  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    p.log.error(`Directory not found: ${targetDir}`);
    return;
  }

  const s = p.spinner();
  s.start('Scanning directories and inspecting codebases...');

  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  const subDirs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'vibe-cli')
    .map((e) => path.join(targetDir, e.name));

  const unlinked: ProjectMetadata[] = [];
  const linkedNames: string[] = [];

  for (const dir of subDirs) {
    const isRegistered = config.registeredProjects.some(
      (proj) => path.resolve(proj.path).toLowerCase() === dir.toLowerCase()
    );
    const hasVaultJunction = fs.existsSync(path.join(dir, '.vault'));

    if (isRegistered || hasVaultJunction) {
      linkedNames.push(path.basename(dir));
    } else {
      try {
        const meta = await inspectProject(dir);
        unlinked.push(meta);
      } catch {
        // ignore errors in inspecting
      }
    }
  }

  s.stop(`Discovered ${pc.bold(String(subDirs.length))} projects (${pc.green(String(linkedNames.length))} already linked, ${pc.yellow(String(unlinked.length))} unlinked).`);

  if (unlinked.length === 0) {
    p.log.success('All projects in this directory are already wired to Obsidian!');
    p.outro(pc.green('Nothing to wire.'));
    return;
  }

  let selectedPaths: string[] = [];

  if (options.all) {
    selectedPaths = unlinked.map((u) => u.projectPath);
  } else {
    const choices = unlinked.map((meta) => ({
      value: meta.projectPath,
      label: `${pc.bold(meta.name)}`,
      hint: `Detected: ${meta.stack.join(', ')} [${meta.category}]`,
    }));

    const selection = await p.multiselect({
      message: 'Select projects to wire into Obsidian (Space to select, Enter to confirm):',
      options: choices,
      required: true,
    });

    if (p.isCancel(selection)) {
      p.cancel('Scan selection canceled.');
      return;
    }

    selectedPaths = selection as string[];
  }

  if (selectedPaths.length === 0) {
    p.log.warn('No projects selected.');
    return;
  }

  // Vault Selection
  const vaultSelection = await promptOrSelectVault(config, options.vault);
  if (!vaultSelection) {
    p.cancel('Scan canceled.');
    return;
  }
  const targetVault = vaultSelection.vaultName;

  const batchSpinner = p.spinner();
  batchSpinner.start(`Wiring ${selectedPaths.length} project(s) into ${targetVault}...`);

  const results: { name: string; success: boolean; error?: string }[] = [];

  for (const projPath of selectedPaths) {
    batchSpinner.message(`Wiring ${path.basename(projPath)}...`);
    const res = await linkProjectPipeline(projPath, targetVault, {
      force: options.force,
    });
    results.push({
      name: path.basename(projPath),
      success: res.success,
      error: res.error,
    });
  }

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success);

  batchSpinner.stop(`Bulk wiring complete: ${pc.green(String(succeeded))} succeeded, ${failed.length > 0 ? pc.red(String(failed.length)) : '0'} failed.`);

  for (const f of failed) {
    p.log.error(`Failed to link ${f.name}: ${f.error}`);
  }

  p.outro(pc.green(`Done! ${succeeded} project(s) wired with live Obsidian junctions.`));
}
