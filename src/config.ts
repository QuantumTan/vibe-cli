import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import type { VibeConfig, RegisteredProject } from './types.js';

export function getConfigPath(): string {
  return path.join(os.homedir(), '.vibeconfig.json');
}

export function getDefaultConfig(): VibeConfig {
  const home = os.homedir();
  const defaultVaultsRoot = path.join(home, 'Documents', 'Obsidian Vaults');
  const defaultProjectsRoot = path.join(home, 'Documents', 'Projects');
  const defaultDevVault = path.join(defaultVaultsRoot, 'Dev-Vault');
  const defaultPortfolio = path.join(defaultProjectsRoot, 'BentoPortfolio');

  return {
    defaultVault: 'Dev-Vault',
    vaultsRoot: defaultVaultsRoot,
    projectsRoot: defaultProjectsRoot,
    portfolioRepoPath: defaultPortfolio,
    vaults: {
      'Dev-Vault': defaultDevVault,
    },
    registeredProjects: [],
  };
}

export function loadConfig(): VibeConfig {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    const defaultConfig = getDefaultConfig();
    saveConfig(defaultConfig);
    return defaultConfig;
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<VibeConfig>;
    const defaults = getDefaultConfig();

    return {
      defaultVault: parsed.defaultVault || defaults.defaultVault,
      vaultsRoot: parsed.vaultsRoot || defaults.vaultsRoot,
      projectsRoot: parsed.projectsRoot || defaults.projectsRoot,
      portfolioRepoPath: parsed.portfolioRepoPath || defaults.portfolioRepoPath,
      vaults: { ...defaults.vaults, ...(parsed.vaults || {}) },
      registeredProjects: Array.isArray(parsed.registeredProjects) ? parsed.registeredProjects : [],
    };
  } catch {
    const defaultConfig = getDefaultConfig();
    saveConfig(defaultConfig);
    return defaultConfig;
  }
}

export function saveConfig(config: VibeConfig): void {
  const configPath = getConfigPath();
  fs.ensureDirSync(path.dirname(configPath));
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

export function getVaultPath(config: VibeConfig, vaultName?: string): string {
  const name = vaultName || config.defaultVault;
  if (config.vaults[name]) {
    return config.vaults[name];
  }
  return path.join(config.vaultsRoot, name);
}

export function registerVault(
  config: VibeConfig,
  name: string,
  vaultPath: string,
  isDefault = false
): VibeConfig {
  config.vaults[name] = vaultPath;
  if (isDefault || !config.defaultVault) {
    config.defaultVault = name;
  }
  saveConfig(config);
  return config;
}

export function upsertRegisteredProject(
  config: VibeConfig,
  project: RegisteredProject
): VibeConfig {
  const normalizedPath = path.resolve(project.path);
  const existingIdx = config.registeredProjects.findIndex(
    (p) => path.resolve(p.path).toLowerCase() === normalizedPath.toLowerCase()
  );

  if (existingIdx >= 0) {
    config.registeredProjects[existingIdx] = {
      ...config.registeredProjects[existingIdx],
      ...project,
      path: normalizedPath,
    };
  } else {
    config.registeredProjects.push({
      ...project,
      path: normalizedPath,
    });
  }

  saveConfig(config);
  return config;
}

export function removeRegisteredProject(
  config: VibeConfig,
  projectNameOrPath: string
): VibeConfig {
  const normalized = path.resolve(projectNameOrPath).toLowerCase();
  config.registeredProjects = config.registeredProjects.filter((p) => {
    return (
      p.name.toLowerCase() !== projectNameOrPath.toLowerCase() &&
      path.resolve(p.path).toLowerCase() !== normalized
    );
  });
  saveConfig(config);
  return config;
}

export function findProjectByPath(
  config: VibeConfig,
  targetPath: string
): RegisteredProject | undefined {
  const normalized = path.resolve(targetPath).toLowerCase();
  return config.registeredProjects.find(
    (p) => path.resolve(p.path).toLowerCase() === normalized
  );
}
