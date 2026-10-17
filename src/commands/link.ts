import path from 'path';
import fs from 'fs-extra';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { loadConfig, getVaultPath, registerVault, upsertRegisteredProject } from '../config.js';
import { inspectProject } from '../inspector.js';
import { openWindowsFolderPicker } from '../gui-picker.js';
import {
  scaffoldVaultProject,
  generateProjectAgentsMd,
  updateVaultDashboard,
  updateVaultAgentsRules,
} from '../templates.js';
import { createJunction, updateGitExclude, checkEnvHealth } from '../junction.js';
import { promptOrSelectVault } from './vault.js';
import type { RegisteredProject } from '../types.js';

export interface LinkOptions {
  browse?: boolean;
  vault?: string;
  showcase?: boolean;
  force?: boolean;
}

export async function linkProjectPipeline(
  targetDir: string,
  vaultName: string,
  options: { showcase?: boolean; force?: boolean } = {}
): Promise<{ success: boolean; project?: RegisteredProject; error?: string }> {
  try {
    const config = loadConfig();
    const vaultPath = getVaultPath(config, vaultName);

    // Ensure vault exists or scaffold it
    if (!fs.existsSync(vaultPath)) {
      fs.ensureDirSync(vaultPath);
      registerVault(config, vaultName, vaultPath);
    }

    const meta = await inspectProject(targetDir);

    // 1. Scaffold Vault Notes
    scaffoldVaultProject(vaultPath, meta, vaultName, options.showcase || false, options.force || false);

    // 2. Scaffold Global Rules if missing
    updateVaultAgentsRules(
      vaultPath,
      config.registeredProjects.filter((p) => p.vault === vaultName)
    );

    // 3. Create NTFS Junctions
    const vaultProjectDir = path.join(vaultPath, '02-Projects', meta.name);
    const vaultGlobalDir = path.join(vaultPath, '00-Global-Rules');

    const linkVault = createJunction(vaultProjectDir, path.join(targetDir, '.vault'));
    const linkGlobal = createJunction(vaultGlobalDir, path.join(targetDir, '.vault-global'));

    if (!linkVault.success) {
      return { success: false, error: linkVault.message };
    }
    if (!linkGlobal.success) {
      return { success: false, error: linkGlobal.message };
    }

    // 4. Generate Local AGENTS.md
    const agentsPath = path.join(targetDir, 'AGENTS.md');
    if (!fs.existsSync(agentsPath) || options.force) {
      fs.writeFileSync(agentsPath, generateProjectAgentsMd(meta), 'utf-8');
    }

    // 5. Update .git/info/exclude
    updateGitExclude(targetDir, ['.vault', '.vault-global', 'AGENTS.md', 'bin/', 'obj/']);

    // 6. Check .env
    checkEnvHealth(targetDir);

    // 7. Register Project in config
    const registered: RegisteredProject = {
      name: meta.name,
      path: targetDir,
      vault: vaultName,
      stack: meta.stack,
      category: meta.category,
      verifyCmd: meta.verifyCmd,
      devCmd: meta.devCmd,
      repoUrl: meta.repoUrl,
      summary: meta.summary,
      showcase: options.showcase || false,
      linkedAt: new Date().toISOString(),
    };

    upsertRegisteredProject(config, registered);

    // 8. Update Vault Dashboard and AGENTS.md with new project list
    const updatedProjects = config.registeredProjects.filter((p) => p.vault === vaultName);
    updateVaultDashboard(vaultPath, updatedProjects);
    updateVaultAgentsRules(vaultPath, updatedProjects);

    return { success: true, project: registered };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function linkCommand(targetPath?: string, options: LinkOptions = {}): Promise<void> {
  const config = loadConfig();
  let selectedDir: string | null = null;

  if (options.browse) {
    selectedDir = await openWindowsFolderPicker('Select Project Folder', config.projectsRoot);
    if (!selectedDir) {
      p.cancel('Folder selection canceled.');
      return;
    }
  } else if (targetPath) {
    selectedDir = path.resolve(targetPath);
  } else {
    // Interactive Picker Mode
    p.intro(pc.bgCyan(pc.black(' vibe link ')) + ' ' + pc.bold('Connect Project to Obsidian Vault'));

    const choices: { value: string; label: string; hint?: string }[] = [
      {
        value: '__BROWSE__',
        label: '📂 Browse with Windows Folder Picker (GUI)...',
        hint: 'Select any folder via native Windows dialog',
      },
      {
        value: process.cwd(),
        label: `📍 Current Directory (${path.basename(process.cwd())})`,
        hint: process.cwd(),
      },
    ];

    // Scan projectsRoot for unlinked candidates
    if (fs.existsSync(config.projectsRoot)) {
      try {
        const entries = fs.readdirSync(config.projectsRoot, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && entry.name !== 'vibe-cli' && !entry.name.startsWith('.')) {
            const fullPath = path.join(config.projectsRoot, entry.name);
            const isRegistered = config.registeredProjects.some(
              (p) => path.resolve(p.path).toLowerCase() === fullPath.toLowerCase()
            );
            if (!isRegistered) {
              choices.push({
                value: fullPath,
                label: `📁 ${entry.name}`,
                hint: 'Unlinked project in Projects root',
              });
            }
          }
        }
      } catch {
        // ignore
      }
    }

    const answer = await p.select({
      message: 'Select the project directory to link:',
      options: choices,
    });

    if (p.isCancel(answer)) {
      p.cancel('Link canceled.');
      return;
    }

    if (answer === '__BROWSE__') {
      selectedDir = await openWindowsFolderPicker('Select Project Folder', config.projectsRoot);
      if (!selectedDir) {
        p.cancel('Folder selection canceled.');
        return;
      }
    } else {
      selectedDir = answer as string;
    }
  }

  if (!fs.existsSync(selectedDir) || !fs.statSync(selectedDir).isDirectory()) {
    p.log.error(`Directory not found: ${selectedDir}`);
    return;
  }

  // Vault Selection
  const vaultSelection = await promptOrSelectVault(config, options.vault);
  if (!vaultSelection) {
    p.cancel('Link canceled.');
    return;
  }
  const selectedVault = vaultSelection.vaultName;

  const s = p.spinner();
  s.start(`Linking ${pc.bold(path.basename(selectedDir))} to ${pc.cyan(selectedVault)}...`);

  const result = await linkProjectPipeline(selectedDir, selectedVault, {
    showcase: options.showcase,
    force: options.force,
  });

  if (!result.success) {
    s.stop(pc.red('Failed to link project.'));
    p.log.error(result.error || 'Unknown error');
    return;
  }

  s.stop(pc.green(`Successfully linked to ${selectedVault}!`));

  const proj = result.project!;
  p.note(
    `Project:    ${pc.bold(proj.name)}\n` +
      `Path:       ${pc.dim(proj.path)}\n` +
      `Vault:      ${pc.cyan(proj.vault)}\n` +
      `Stack:      ${pc.yellow(proj.stack.join(', '))}\n` +
      `Category:   ${pc.magenta(proj.category)}\n` +
      `Verify Cmd: ${pc.green(proj.verifyCmd || 'None')}\n` +
      `Junctions:  .vault/ -> 02-Projects/${proj.name}\n` +
      `            .vault-global/ -> 00-Global-Rules`,
    'Project Wired'
  );

  p.outro(pc.green('Vibe coding enabled. AI agents now have live context!'));
}
