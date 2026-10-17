import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';
import {
  generateContextMd,
  generateProjectAgentsMd,
  scaffoldVaultProject,
  updateVaultDashboard,
  updateVaultAgentsRules,
} from '../src/templates.js';
import type { ProjectMetadata, RegisteredProject } from '../src/types.js';

describe('Markdown Generators & Vault Scaffolding', () => {
  let tmpVault: string;

  beforeEach(() => {
    tmpVault = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-vault-'));
  });

  afterEach(() => {
    fs.removeSync(tmpVault);
  });

  const sampleMeta: ProjectMetadata = {
    name: 'SampleApp',
    projectPath: 'C:\\Projects\\SampleApp',
    stack: ['React', 'TypeScript', 'Vite'],
    category: 'Web App',
    verifyCmd: 'npm run build',
    devCmd: 'npm run dev',
    repoUrl: 'https://github.com/user/SampleApp',
    summary: 'A high performance modern web application.',
  };

  it('generates _Context.md strictly within 60 lines with valid frontmatter', () => {
    const content = generateContextMd(sampleMeta, 'Dev-Vault', true);
    const lines = content.split(/\r?\n/);

    expect(lines.length).toBeLessThanOrEqual(60);

    const parsed = matter(content);
    expect(parsed.data.title).toBe('SampleApp');
    expect(parsed.data.vault).toBe('Dev-Vault');
    expect(parsed.data.showcase).toBe(true);
    expect(parsed.data.stack).toEqual(['React', 'TypeScript', 'Vite']);
    expect(parsed.data.category).toBe('Web App');
    expect(parsed.data.repoUrl).toBe('https://github.com/user/SampleApp');
  });

  it('generates platform tailored AGENTS.md rules', () => {
    const webAgents = generateProjectAgentsMd(sampleMeta);
    expect(webAgents).toContain('Modern Web Application Directives');
    expect(webAgents).toContain('.vault/_Context.md');

    const mobileAgents = generateProjectAgentsMd({
      ...sampleMeta,
      category: 'Mobile App',
      stack: ['Flutter', 'Dart'],
    });
    expect(mobileAgents).toContain('Mobile Development Directives');
    expect(mobileAgents).toContain('48x48dp');

    const desktopAgents = generateProjectAgentsMd({
      ...sampleMeta,
      category: 'Desktop App',
      stack: ['C#', '.NET', 'WPF'],
    });
    expect(desktopAgents).toContain('Desktop Application Directives');
    expect(desktopAgents).toContain('MVVM');
  });

  it('scaffolds complete vault project directory structure', () => {
    const projectDir = scaffoldVaultProject(tmpVault, sampleMeta, 'Dev-Vault');

    expect(fs.existsSync(path.join(projectDir, '_Context.md'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'Architecture', '00-Symbol-Index.md'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'Memory-Bank', 'Lessons-and-Gotchas.md'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'Memory-Bank', 'Archive.md'))).toBe(true);
  });

  it('updates 00-Dashboard.md and 00-Global-Rules/AGENTS.md with registered projects', () => {
    const projects: RegisteredProject[] = [
      {
        name: 'SampleApp',
        path: 'C:\\Projects\\SampleApp',
        vault: 'Dev-Vault',
        stack: ['React', 'TypeScript'],
        category: 'Web App',
        showcase: true,
        linkedAt: new Date().toISOString(),
      },
    ];

    updateVaultDashboard(tmpVault, projects);
    updateVaultAgentsRules(tmpVault, projects);

    const dashboard = fs.readFileSync(path.join(tmpVault, '00-Dashboard.md'), 'utf-8');
    expect(dashboard).toContain('SampleApp');
    expect(dashboard).toContain('[[02-Projects/SampleApp/_Context|SampleApp]]');

    const agents = fs.readFileSync(path.join(tmpVault, '00-Global-Rules', 'AGENTS.md'), 'utf-8');
    expect(agents).toContain('SampleApp');
    expect(agents).toContain('`C:\\Projects\\SampleApp`');
  });
});
