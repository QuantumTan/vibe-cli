import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import {
  inspectProject,
  normalizeGitUrl,
  extractReadmeSummary,
} from '../src/inspector.js';

describe('Inspector & Auto-Detection', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-test-'));
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  it('normalizes git remote URLs correctly', () => {
    expect(normalizeGitUrl('git@github.com:octocat/Hello-World.git')).toBe(
      'https://github.com/octocat/Hello-World'
    );
    expect(normalizeGitUrl('https://github.com/octocat/Hello-World.git')).toBe(
      'https://github.com/octocat/Hello-World'
    );
    expect(normalizeGitUrl('https://github.com/octocat/Hello-World')).toBe(
      'https://github.com/octocat/Hello-World'
    );
  });

  it('extracts and truncates README summaries cleanly', () => {
    const readmeContent = `
# My Awesome Project

[![Build Status](https://img.shields.io/badge/status-ok-green)](#)

This is a comprehensive description of an ultra-modern application that connects multiple tools together into an awesome unified development workflow for developers.

## Features
- Feature 1
- Feature 2
`;
    fs.writeFileSync(path.join(tmpDir, 'README.md'), readmeContent, 'utf-8');
    const summary = extractReadmeSummary(tmpDir, 'My Awesome Project');
    expect(summary).toContain('This is a comprehensive description');
    expect(summary.length).toBeLessThanOrEqual(140);
  });

  it('auto-detects React + Vite + TypeScript projects', async () => {
    fs.writeJsonSync(path.join(tmpDir, 'package.json'), {
      name: 'react-vite-app',
      dependencies: {
        react: '^18.0.0',
        'react-dom': '^18.0.0',
      },
      devDependencies: {
        vite: '^5.0.0',
        typescript: '^5.0.0',
        tailwindcss: '^3.0.0',
      },
      scripts: {
        dev: 'vite',
        build: 'tsc && vite build',
      },
    });

    const meta = await inspectProject(tmpDir);
    expect(meta.stack).toContain('React');
    expect(meta.stack).toContain('Vite');
    expect(meta.stack).toContain('TypeScript');
    expect(meta.stack).toContain('Tailwind CSS');
    expect(meta.category).toBe('Web App');
    expect(meta.verifyCmd).toBe('npm run build');
    expect(meta.devCmd).toBe('npm run dev');
  });

  it('auto-detects Laravel / PHP projects', async () => {
    fs.writeFileSync(path.join(tmpDir, 'artisan'), '#!/usr/bin/env php\n', 'utf-8');
    fs.writeJsonSync(path.join(tmpDir, 'composer.json'), {
      name: 'laravel/laravel',
      require: {
        php: '^8.2',
      },
    });

    const meta = await inspectProject(tmpDir);
    expect(meta.stack).toContain('PHP');
    expect(meta.stack).toContain('Laravel');
    expect(meta.category).toBe('Web App');
    expect(meta.verifyCmd).toBe('php artisan test');
    expect(meta.devCmd).toBe('php artisan serve');
  });

  it('auto-detects .NET WPF desktop applications', async () => {
    const csproj = `
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net8.0-windows</TargetFramework>
    <UseWPF>true</UseWPF>
  </PropertyGroup>
</Project>
`;
    fs.writeFileSync(path.join(tmpDir, 'App.csproj'), csproj, 'utf-8');

    const meta = await inspectProject(tmpDir);
    expect(meta.stack).toContain('C#');
    expect(meta.stack).toContain('.NET');
    expect(meta.stack).toContain('WPF');
    expect(meta.category).toBe('Desktop App');
    expect(meta.verifyCmd).toBe('dotnet build');
    expect(meta.devCmd).toBe('dotnet watch run');
  });

  it('auto-detects Flutter / Dart mobile applications', async () => {
    const pubspec = `
name: my_mobile_app
description: A new Flutter project.
dependencies:
  flutter:
    sdk: flutter
`;
    fs.writeFileSync(path.join(tmpDir, 'pubspec.yaml'), pubspec, 'utf-8');

    const meta = await inspectProject(tmpDir);
    expect(meta.stack).toContain('Flutter');
    expect(meta.stack).toContain('Dart');
    expect(meta.category).toBe('Mobile App');
    expect(meta.verifyCmd).toBe('flutter analyze');
    expect(meta.devCmd).toBe('flutter run');
    expect(meta.platformNotes?.flutterPackage).toBe('my_mobile_app');
  });
});
