import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import {
  getDefaultConfig,
  upsertRegisteredProject,
  removeRegisteredProject,
  findProjectByPath,
} from '../src/config.js';
import type { VibeConfig, RegisteredProject } from '../src/types.js';

describe('Configuration Manager', () => {
  it('returns valid default configuration', () => {
    const config = getDefaultConfig();
    expect(config.defaultVault).toBe('Dev-Vault');
    expect(config.vaults['Dev-Vault']).toBeDefined();
    expect(config.registeredProjects).toEqual([]);
  });

  it('upserts and searches registered projects correctly', () => {
    let config: VibeConfig = getDefaultConfig();
    const project: RegisteredProject = {
      name: 'TestProject',
      path: 'C:\\Users\\ACER\\Documents\\Projects\\TestProject',
      vault: 'Dev-Vault',
      stack: ['Vue', 'JavaScript'],
      category: 'Web App',
      showcase: false,
      linkedAt: new Date().toISOString(),
    };

    config = upsertRegisteredProject(config, project);
    expect(config.registeredProjects.length).toBe(1);

    const found = findProjectByPath(config, 'c:\\users\\acer\\documents\\projects\\testproject');
    expect(found).toBeDefined();
    expect(found?.name).toBe('TestProject');

    // Update existing project
    config = upsertRegisteredProject(config, {
      ...project,
      showcase: true,
    });
    expect(config.registeredProjects.length).toBe(1);
    expect(config.registeredProjects[0].showcase).toBe(true);

    // Remove project
    config = removeRegisteredProject(config, 'TestProject');
    expect(config.registeredProjects.length).toBe(0);
  });
});
