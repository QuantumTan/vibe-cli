import path from 'path';
import fs from 'fs-extra';
import chokidar from 'chokidar';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { loadConfig } from '../config.js';
import { syncCommand } from './sync.js';
import { linkProjectPipeline } from './link.js';

export interface WatchOptions {
  autoLink?: boolean;
}

export async function watchCommand(options: WatchOptions = {}): Promise<void> {
  const config = loadConfig();
  p.intro(pc.bgYellow(pc.black(' vibe watch ')) + ' ' + pc.bold('Live Vault & Project Daemon'));

  const vaultDirs = Object.values(config.vaults).map((v) => path.join(v, '02-Projects'));
  p.log.info(`Watching Vault Contexts in: ${vaultDirs.map((v) => pc.dim(v)).join(', ')}`);

  if (options.autoLink) {
    p.log.info(`Auto-Link enabled: Watching for new projects in ${pc.dim(config.projectsRoot)}`);
  }

  let syncTimeout: NodeJS.Timeout | null = null;
  const triggerDebouncedSync = () => {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      p.log.message(pc.cyan('Change detected in Vault notes. Triggering sync...'));
      syncCommand().catch(() => {});
    }, 1500);
  };

  // 1. Vault Projects Watcher
  const vaultWatcher = chokidar.watch(vaultDirs, {
    ignoreInitial: true,
    depth: 3,
  });

  vaultWatcher.on('all', (event, filePath) => {
    if (filePath.endsWith('_Context.md')) {
      triggerDebouncedSync();
    }
  });

  // 2. Auto-Link Watcher (if requested)
  if (options.autoLink && fs.existsSync(config.projectsRoot)) {
    const projectWatcher = chokidar.watch(config.projectsRoot, {
      ignoreInitial: true,
      depth: 2,
    });

    const pendingLinks = new Set<string>();

    projectWatcher.on('add', async (filePath) => {
      const fileName = path.basename(filePath);
      const isProjectMarker = [
        'package.json',
        'composer.json',
        'pubspec.yaml',
        'Cargo.toml',
        'pyproject.toml',
        'requirements.txt',
        'go.mod',
      ].includes(fileName) || fileName.endsWith('.csproj');

      if (isProjectMarker) {
        const folder = path.dirname(filePath);
        if (folder === config.projectsRoot || pendingLinks.has(folder)) return;

        // Ensure not vibe-cli itself
        if (path.basename(folder) === 'vibe-cli') return;

        // Check if already registered
        const currentConfig = loadConfig();
        const alreadyLinked = currentConfig.registeredProjects.some(
          (proj) => path.resolve(proj.path).toLowerCase() === path.resolve(folder).toLowerCase()
        );
        if (alreadyLinked) return;

        pendingLinks.add(folder);
        p.log.step(pc.green(`⚡ New project marker detected in ${pc.bold(path.basename(folder))}`));

        setTimeout(async () => {
          const res = await linkProjectPipeline(folder, currentConfig.defaultVault);
          pendingLinks.delete(folder);
          if (res.success) {
            p.log.success(`Auto-linked ${pc.bold(path.basename(folder))} to ${currentConfig.defaultVault}!`);
          }
        }, 1000);
      }
    });
  }

  p.log.success(pc.green('Daemon active. Press Ctrl+C to exit.'));
}
