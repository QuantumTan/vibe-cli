import path from 'path';
import fs from 'fs-extra';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { loadConfig, saveConfig, registerVault, getVaultPath } from '../config.js';
import { updateVaultDashboard, updateVaultAgentsRules } from '../templates.js';
import { openWindowsFolderPicker } from '../gui-picker.js';
import type { VibeConfig } from '../types.js';

export interface VaultSelectionResult {
  vaultName: string;
  vaultPath: string;
}

export interface VaultCreateOptions {
  path?: string;
  browse?: boolean;
  use?: boolean;
}

/**
 * Universal interactive prompt that lets the user choose an existing vault,
 * create a brand new vault, or browse and register an existing Obsidian folder on PC.
 */
export async function promptOrSelectVault(
  config: VibeConfig,
  explicitVault?: string
): Promise<VaultSelectionResult | null> {
  // If an explicit vault was passed via CLI flags (e.g. --vault MyVault)
  if (explicitVault) {
    if (config.vaults[explicitVault]) {
      return { vaultName: explicitVault, vaultPath: config.vaults[explicitVault] };
    }
    // Auto-scaffold new vault under vaultsRoot if not registered yet
    const newPath = path.join(config.vaultsRoot, explicitVault);
    fs.ensureDirSync(newPath);
    fs.ensureDirSync(path.join(newPath, '00-Global-Rules'));
    fs.ensureDirSync(path.join(newPath, '02-Projects'));
    updateVaultDashboard(newPath, []);
    updateVaultAgentsRules(newPath, []);
    registerVault(config, explicitVault, newPath);
    return { vaultName: explicitVault, vaultPath: newPath };
  }

  // Interactive Vault Selection Menu
  const vaultChoices: { value: string; label: string; hint?: string }[] = [];

  for (const [name, vPath] of Object.entries(config.vaults)) {
    const isDefault = name === config.defaultVault;
    vaultChoices.push({
      value: name,
      label: `${isDefault ? '💎 ' : '📁 '}${pc.bold(name)}${isDefault ? pc.green(' (Default)') : ''}`,
      hint: vPath,
    });
  }

  vaultChoices.push({
    value: '__NEW_VAULT__',
    label: '➕ Create a New Vault...',
    hint: 'Name and scaffold a brand new Obsidian Vault',
  });

  vaultChoices.push({
    value: '__BROWSE_VAULT__',
    label: '🔍 Browse for Existing Vault on PC (GUI)...',
    hint: 'Point to any existing Obsidian folder on your drive',
  });

  const selected = await p.select({
    message: 'Which Obsidian Vault should this project be wired to?',
    options: vaultChoices,
  });

  if (p.isCancel(selected)) {
    return null;
  }

  // 1. User chose an already registered vault
  if (selected !== '__NEW_VAULT__' && selected !== '__BROWSE_VAULT__') {
    const vaultName = selected as string;
    return { vaultName, vaultPath: config.vaults[vaultName] };
  }

  // 2. User chose to create a new vault
  if (selected === '__NEW_VAULT__') {
    const nameInput = await p.text({
      message: 'Enter name for your new Vault:',
      placeholder: 'Personal-Vault',
      validate: (val) => (!val?.trim() ? 'Vault name cannot be empty' : undefined),
    });

    if (p.isCancel(nameInput)) return null;
    const newName = (nameInput as string).trim();

    const locChoice = await p.select({
      message: `Where should ${newName} be located?`,
      options: [
        {
          value: 'default',
          label: `📁 Default Vaults Folder`,
          hint: path.join(config.vaultsRoot, newName),
        },
        {
          value: 'custom',
          label: `📂 Choose Custom Folder with Windows GUI Dialog...`,
          hint: 'Select any folder on any drive',
        },
      ],
    });

    if (p.isCancel(locChoice)) return null;

    let targetPath = path.join(config.vaultsRoot, newName);
    if (locChoice === 'custom') {
      const chosen = await openWindowsFolderPicker(`Select Folder for ${newName}`, config.vaultsRoot);
      if (!chosen) return null;
      targetPath = chosen;
    }

    const s = p.spinner();
    s.start(`Scaffolding new Vault: ${pc.cyan(newName)}...`);
    fs.ensureDirSync(targetPath);
    fs.ensureDirSync(path.join(targetPath, '00-Global-Rules'));
    fs.ensureDirSync(path.join(targetPath, '02-Projects'));
    updateVaultDashboard(targetPath, []);
    updateVaultAgentsRules(targetPath, []);

    registerVault(config, newName, targetPath);
    s.stop(pc.green(`Vault ${pc.bold(newName)} created and registered!`));

    return { vaultName: newName, vaultPath: targetPath };
  }

  // 3. User chose to browse and register an existing Obsidian folder on PC
  if (selected === '__BROWSE_VAULT__') {
    const chosenDir = await openWindowsFolderPicker('Select Your Existing Obsidian Vault Folder', config.vaultsRoot);
    if (!chosenDir) return null;

    const defaultName = path.basename(chosenDir);
    const nameInput = await p.text({
      message: 'Confirm or edit the Vault name for vibe:',
      initialValue: defaultName,
      validate: (val) => (!val?.trim() ? 'Name cannot be empty' : undefined),
    });

    if (p.isCancel(nameInput)) return null;
    const vaultName = (nameInput as string).trim();

    const s = p.spinner();
    s.start(`Registering Vault: ${pc.cyan(vaultName)}...`);

    // Ensure standard subdirectories exist non-destructively
    fs.ensureDirSync(chosenDir);
    fs.ensureDirSync(path.join(chosenDir, '00-Global-Rules'));
    fs.ensureDirSync(path.join(chosenDir, '02-Projects'));
    updateVaultDashboard(chosenDir, []);
    updateVaultAgentsRules(chosenDir, []);

    registerVault(config, vaultName, chosenDir);
    s.stop(pc.green(`Vault ${pc.bold(vaultName)} registered successfully!`));

    return { vaultName, vaultPath: chosenDir };
  }

  return null;
}

export async function vaultCreateCommand(vaultName?: string, options: VaultCreateOptions = {}): Promise<void> {
  const config = loadConfig();
  p.intro(pc.bgBlue(pc.black(' vibe vault create ')) + ' ' + pc.bold('Initialize Obsidian Vault'));

  let name = vaultName;
  if (!name) {
    const input = await p.text({
      message: 'Enter Vault name:',
      placeholder: 'Dev-Vault',
      validate: (val) => (!val?.trim() ? 'Vault name cannot be empty' : undefined),
    });

    if (p.isCancel(input)) {
      p.cancel('Vault creation canceled.');
      return;
    }
    name = (input as string).trim();
  }

  let vaultPath = options.path ? path.resolve(options.path) : path.join(config.vaultsRoot, name);

  if (options.browse) {
    const chosen = await openWindowsFolderPicker('Select Folder for Obsidian Vault', config.vaultsRoot);
    if (!chosen) {
      p.cancel('Vault creation canceled.');
      return;
    }
    vaultPath = chosen;
  }

  const s = p.spinner();
  s.start(`Scaffolding Vault at ${pc.dim(vaultPath)}...`);

  fs.ensureDirSync(vaultPath);
  fs.ensureDirSync(path.join(vaultPath, '00-Global-Rules'));
  fs.ensureDirSync(path.join(vaultPath, '02-Projects'));

  // Initialize Dashboard and Global Rules
  const existingProjects = config.registeredProjects.filter((p) => p.vault === name);
  updateVaultDashboard(vaultPath, existingProjects);
  updateVaultAgentsRules(vaultPath, existingProjects);

  // Register in config
  registerVault(config, name, vaultPath, options.use || false);

  s.stop(pc.green(`Vault ${pc.bold(name)} registered and scaffolded!`));
  p.note(`Location: ${vaultPath}\nDefault:  ${options.use ? 'Yes' : 'No'}`, 'Vault Ready');
  p.outro(pc.green('Obsidian is ready to orchestrate your projects.'));
}

export async function vaultListCommand(): Promise<void> {
  const config = loadConfig();
  p.intro(pc.bgBlue(pc.black(' vibe vault list ')) + ' ' + pc.bold('Registered Obsidian Vaults'));

  const vaultNames = Object.keys(config.vaults);
  if (vaultNames.length === 0) {
    p.log.warn('No vaults registered yet. Create one with `vibe vault create <name>`.');
    return;
  }

  for (const name of vaultNames) {
    const vPath = config.vaults[name];
    const isDefault = name === config.defaultVault;
    const projectCount = config.registeredProjects.filter((p) => p.vault === name).length;

    p.note(
      `Path:     ${pc.dim(vPath)}\n` +
        `Projects: ${pc.yellow(String(projectCount))} linked\n` +
        `Default:  ${isDefault ? pc.green('Yes (Active)') : pc.dim('No')}`,
      `${name} ${isDefault ? pc.green('★') : ''}`
    );
  }

  p.outro(pc.cyan(`Total vaults: ${vaultNames.length}`));
}

export async function vaultSwitchCommand(vaultName?: string): Promise<void> {
  const config = loadConfig();
  p.intro(pc.bgBlue(pc.black(' vibe vault switch ')) + ' ' + pc.bold('Set Default Obsidian Vault'));

  const vaultNames = Object.keys(config.vaults);
  if (vaultNames.length === 0) {
    p.log.error('No vaults available. Create one first with `vibe vault create`.');
    return;
  }

  let selected = vaultName;
  if (!selected) {
    const choices = vaultNames.map((name) => ({
      value: name,
      label: `${name}${name === config.defaultVault ? ' (Currently Active)' : ''}`,
    }));

    const answer = await p.select({
      message: 'Select default Vault:',
      options: choices,
    });

    if (p.isCancel(answer)) {
      p.cancel('Switch canceled.');
      return;
    }

    selected = answer as string;
  }

  if (!config.vaults[selected]) {
    p.log.error(`Vault "${selected}" not found in registered vaults.`);
    return;
  }

  config.defaultVault = selected;
  saveConfig(config);

  p.log.success(`Default vault switched to ${pc.bold(pc.green(selected))}.`);
  p.outro(pc.green('Updated ~/.vibeconfig.json'));
}
