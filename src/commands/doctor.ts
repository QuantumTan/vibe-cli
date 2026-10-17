import { execSync } from 'child_process';
import fs from 'fs-extra';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { loadConfig, getConfigPath } from '../config.js';

interface CheckItem {
  name: string;
  category: string;
  status: 'ok' | 'warn' | 'fail';
  detail: string;
}

function runSilent(cmd: string): string | null {
  try {
    return execSync(cmd, { stdio: ['pipe', 'pipe', 'pipe'] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

export async function doctorCommand(): Promise<void> {
  p.intro(pc.bgMagenta(pc.black(' vibe doctor ')) + ' ' + pc.bold('Multi-Platform Vibe Coding Health Diagnostic'));

  const s = p.spinner();
  s.start('Inspecting development environment and toolchains...');

  const results: CheckItem[] = [];

  // 1. Core Runtime (Node, NPM, Git)
  const nodeVer = process.version;
  results.push({
    name: 'Node.js Runtime',
    category: 'Core',
    status: 'ok',
    detail: nodeVer,
  });

  const npmVer = runSilent('npm -v');
  results.push({
    name: 'NPM Package Manager',
    category: 'Core',
    status: npmVer ? 'ok' : 'fail',
    detail: npmVer ? `v${npmVer}` : 'Not found on PATH',
  });

  const gitVer = runSilent('git --version');
  results.push({
    name: 'Git VCS',
    category: 'Core',
    status: gitVer ? 'ok' : 'fail',
    detail: gitVer || 'Not found on PATH',
  });

  // 2. Desktop & .NET Toolchain
  const dotnetVer = runSilent('dotnet --version');
  results.push({
    name: '.NET SDK (C# / Desktop / Web)',
    category: 'Desktop & Web',
    status: dotnetVer ? 'ok' : 'warn',
    detail: dotnetVer ? `v${dotnetVer}` : 'Not installed (needed for .NET/C# projects)',
  });

  // 3. Mobile Toolchain (Flutter / Dart / Android)
  const flutterVer = runSilent('flutter --version');
  results.push({
    name: 'Flutter SDK (Android / iOS / Mobile)',
    category: 'Mobile',
    status: flutterVer ? 'ok' : 'warn',
    detail: flutterVer ? flutterVer.split('\n')[0] : 'Not installed (needed for Flutter mobile projects)',
  });

  // 4. Web & Backend Toolchains (PHP / Composer / Python)
  const phpVer = runSilent('php -v');
  results.push({
    name: 'PHP Runtime (Laravel)',
    category: 'Web',
    status: phpVer ? 'ok' : 'warn',
    detail: phpVer ? phpVer.split('\n')[0] : 'Not installed (needed for Laravel projects)',
  });

  const pythonVer = runSilent('python --version');
  results.push({
    name: 'Python Runtime',
    category: 'Scripting & AI',
    status: pythonVer ? 'ok' : 'warn',
    detail: pythonVer || 'Not installed',
  });

  // 5. Vibe Configuration & Vaults
  const configPath = getConfigPath();
  const configExists = fs.existsSync(configPath);
  results.push({
    name: 'Vibe Global Config (~/.vibeconfig.json)',
    category: 'Vibe Hub',
    status: configExists ? 'ok' : 'warn',
    detail: configExists ? configPath : 'Will be initialized on first run',
  });

  const config = loadConfig();
  const defaultVaultPath = config.vaults[config.defaultVault];
  const vaultExists = defaultVaultPath && fs.existsSync(defaultVaultPath);
  results.push({
    name: `Default Obsidian Vault (${config.defaultVault})`,
    category: 'Vibe Hub',
    status: vaultExists ? 'ok' : 'warn',
    detail: vaultExists ? defaultVaultPath : 'Vault directory not scaffolded yet. Run `vibe vault create`',
  });

  s.stop('Diagnostic complete.');

  // Render results
  for (const item of results) {
    const symbol =
      item.status === 'ok'
        ? pc.green('✓')
        : item.status === 'warn'
        ? pc.yellow('!')
        : pc.red('✗');

    p.note(
      `Status: ${item.status.toUpperCase()}\nDetail: ${pc.dim(item.detail)}`,
      `${symbol} [${item.category}] ${item.name}`
    );
  }

  p.outro(pc.green('Vibe health diagnostic finished!'));
}
