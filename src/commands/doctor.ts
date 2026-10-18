import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { loadConfig, getConfigPath } from '../config.js';
import { getHardwareProfile, HardwareProfile } from '../utils/hardware-probe.js';

interface CheckItem {
  name: string;
  category: string;
  status: 'ok' | 'warn' | 'fail';
  detail: string;
}

export interface DoctorOptions {
  student?: boolean;
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

export async function doctorCommand(options: DoctorOptions = {}): Promise<void> {
  const isStudent = options.student !== false;
  p.intro(
    pc.bgMagenta(pc.black(' vibe doctor ')) +
      ' ' +
      pc.bold(isStudent ? 'Zero-Budget Student & Local Model Diagnostic' : 'Multi-Platform Health Diagnostic')
  );

  const s = p.spinner();
  s.start('Inspecting development environment and hardware profile...');

  const results: CheckItem[] = [];

  // 1. Hardware Profile (RAM & GPU VRAM)
  const hw = getHardwareProfile();
  const vramText = hw.vramGb ? `${hw.vramGb} GB VRAM (${hw.gpuName})` : 'Integrated GPU (No dedicated VRAM detected)';

  results.push({
    name: 'System Memory & GPU',
    category: 'Hardware',
    status: hw.tier === 'low' ? 'warn' : 'ok',
    detail: `RAM: ${hw.totalRamGb} GB total (${hw.freeRamGb} GB free) | GPU: ${vramText}`,
  });

  results.push({
    name: 'Recommended Local Model',
    category: 'Hardware',
    status: 'ok',
    detail: `${hw.recommendedLocalModel} | Cap: --num-ctx ${hw.recommendedContextCap}\n${pc.dim(hw.advice)}`,
  });

  // 2. Free Tier API Keys in .env
  const cwd = process.cwd();
  const envPath = path.join(cwd, '.env');
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  const freeTierKeys = [
    {
      key: 'GEMINI_API_KEY',
      name: 'Gemini Free (Google AI Studio)',
      signup: 'https://aistudio.google.com/app/apikey',
    },
    {
      key: 'GROQ_API_KEY',
      name: 'Groq Free (Llama 3.1 8B / 70B)',
      signup: 'https://console.groq.com/keys',
    },
    {
      key: 'GITHUB_TOKEN',
      name: 'GitHub Models (PAT)',
      signup: 'https://github.com/settings/tokens',
    },
    {
      key: 'OPENROUTER_API_KEY',
      name: 'OpenRouter Free Tier',
      signup: 'https://openrouter.ai/keys',
    },
  ];

  for (const { key, name, signup } of freeTierKeys) {
    const presentInEnv = new RegExp(`^${key}=.+`, 'm').test(envContent);
    const presentInProcess = Boolean(process.env[key]);
    const configured = presentInEnv || presentInProcess;

    results.push({
      name: `${name} (${key})`,
      category: 'Free API Tiers',
      status: configured ? 'ok' : 'warn',
      detail: configured ? 'Configured in environment.' : `Missing key! Get 100% free API key (no credit card): ${signup}`,
    });
  }

  // 3. Core Runtime (Node, NPM, Git)
  const nodeVer = process.version;
  results.push({
    name: 'Node.js Runtime',
    category: 'Core',
    status: 'ok',
    detail: nodeVer,
  });

  const gitVer = runSilent('git --version');
  results.push({
    name: 'Git VCS',
    category: 'Core',
    status: gitVer ? 'ok' : 'fail',
    detail: gitVer || 'Not found on PATH',
  });

  // 4. Local Ollama Runner
  const ollamaVer = runSilent('ollama --version');
  results.push({
    name: 'Local Ollama Engine',
    category: 'Local AI',
    status: ollamaVer ? 'ok' : 'warn',
    detail: ollamaVer ? ollamaVer : 'Not installed. Install from https://ollama.com to run offline local models.',
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

  s.stop('Hardware & environment inspection complete.');

  // Render results
  for (const item of results) {
    const symbol =
      item.status === 'ok'
        ? pc.green('✓')
        : item.status === 'warn'
        ? pc.yellow('!')
        : pc.red('✗');

    p.note(
      `Status: ${item.status.toUpperCase()}\nDetail: ${item.detail}`,
      `${symbol} [${item.category}] ${item.name}`
    );
  }

  p.outro(pc.green('Vibe health diagnostic finished!'));
}
