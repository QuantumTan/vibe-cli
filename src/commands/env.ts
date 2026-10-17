import path from 'path';
import fs from 'fs-extra';
import * as p from '@clack/prompts';
import pc from 'picocolors';

export interface EnvKeyInfo {
  key: string;
  hasValue: boolean;
  isSecret: boolean;
}

export interface EnvAuditResult {
  hasEnv: boolean;
  hasExample: boolean;
  envKeys: string[];
  exampleKeys: string[];
  missingInExample: string[];
  missingInEnv: string[];
  leakedKeys: string[];
  gitIgnored: boolean;
}

export function parseEnvKeys(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim();
      if (key) {
        result[key] = val;
      }
    }
  }

  return result;
}

export function detectLeakedSecret(value: string): boolean {
  if (!value) return false;
  // High-confidence secret patterns
  const patterns = [
    /sk_live_[0-9a-zA-Z]{24,}/,
    /sk_test_[0-9a-zA-Z]{24,}/,
    /ghp_[0-9a-zA-Z]{36}/,
    /AKIA[0-9A-Z]{16}/,
    /AIza[0-9A-Za-z-_]{35}/,
    /-----BEGIN (RSA|EC|OPENSSH|PGP|PRIVATE) KEY-----/,
  ];

  return patterns.some((p) => p.test(value));
}

/**
 * Audits environment files (.env and .env.example) for discrepancies and secret leaks.
 */
export async function auditEnvironmentFiles(cwd: string): Promise<EnvAuditResult> {
  const envPath = path.join(cwd, '.env');
  const examplePath = path.join(cwd, '.env.example');
  const gitignorePath = path.join(cwd, '.gitignore');

  const hasEnv = await fs.pathExists(envPath);
  const hasExample = await fs.pathExists(examplePath);

  let envMap: Record<string, string> = {};
  let exampleMap: Record<string, string> = {};

  if (hasEnv) {
    envMap = parseEnvKeys(await fs.readFile(envPath, 'utf8'));
  }

  if (hasExample) {
    exampleMap = parseEnvKeys(await fs.readFile(examplePath, 'utf8'));
  }

  const envKeys = Object.keys(envMap);
  const exampleKeys = Object.keys(exampleMap);

  const missingInExample = envKeys.filter((k) => !exampleKeys.includes(k));
  const missingInEnv = exampleKeys.filter((k) => !envKeys.includes(k));

  // Check for leaked secrets in .env.example
  const leakedKeys: string[] = [];
  for (const [k, v] of Object.entries(exampleMap)) {
    if (detectLeakedSecret(v)) {
      leakedKeys.push(k);
    }
  }

  // Check if .env is gitignored
  let gitIgnored = false;
  if (await fs.pathExists(gitignorePath)) {
    const gitignore = await fs.readFile(gitignorePath, 'utf8');
    gitIgnored = /(?:^|\n)\.env(?:\.local)?(?:\s|$)/m.test(gitignore);
  }

  return {
    hasEnv,
    hasExample,
    envKeys,
    exampleKeys,
    missingInExample,
    missingInEnv,
    leakedKeys,
    gitIgnored,
  };
}

/**
 * Synchronizes .env.example with missing keys from .env.
 */
export async function syncEnvExample(cwd: string): Promise<{ addedKeys: string[]; examplePath: string }> {
  const envPath = path.join(cwd, '.env');
  const examplePath = path.join(cwd, '.env.example');

  if (!(await fs.pathExists(envPath))) {
    return { addedKeys: [], examplePath };
  }

  const envContent = await fs.readFile(envPath, 'utf8');
  const envMap = parseEnvKeys(envContent);

  let exampleContent = '';
  let exampleMap: Record<string, string> = {};

  if (await fs.pathExists(examplePath)) {
    exampleContent = await fs.readFile(examplePath, 'utf8');
    exampleMap = parseEnvKeys(exampleContent);
  }

  const addedKeys: string[] = [];
  let appendContent = '';

  for (const key of Object.keys(envMap)) {
    if (!exampleMap[key]) {
      addedKeys.push(key);
      const isPublic = key.startsWith('NEXT_PUBLIC_') || key.startsWith('VITE_') || key.startsWith('PUBLIC_');
      const placeholder = isPublic ? 'http://localhost:3000' : `your_${key.toLowerCase()}_here`;
      appendContent += `${key}=${placeholder}\n`;
    }
  }

  if (addedKeys.length > 0) {
    const divider = exampleContent.length > 0 && !exampleContent.endsWith('\n') ? '\n' : '';
    await fs.writeFile(examplePath, exampleContent + divider + appendContent, 'utf8');
  }

  return { addedKeys, examplePath };
}

/**
 * vibe env [options]
 */
export async function envCommand(options: { sync?: boolean; check?: boolean } = {}): Promise<void> {
  const cwd = process.cwd();
  p.intro(pc.bgCyan(pc.black(' vibe env ')) + ' ' + pc.bold('Environment & Secret Sentinel'));

  const s = p.spinner();
  s.start('Auditing environment configurations and scanning for secret leaks...');

  const audit = await auditEnvironmentFiles(cwd);

  s.stop('Audit complete.');

  // If sync requested
  if (options.sync) {
    const syncRes = await syncEnvExample(cwd);
    if (syncRes.addedKeys.length > 0) {
      p.log.success(
        pc.green(`Added ${syncRes.addedKeys.length} missing key(s) to .env.example with sanitized placeholders:\n`) +
          syncRes.addedKeys.map((k) => `  • ${pc.bold(k)}`).join('\n')
      );
    } else {
      p.log.info('.env.example is already up to date with .env.');
    }
  }

  // Report findings
  const notes: string[] = [];

  notes.push(
    `Files Present:   .env: ${audit.hasEnv ? pc.green('✔') : pc.dim('✖')} | .env.example: ${audit.hasExample ? pc.green('✔') : pc.dim('✖')}`
  );
  notes.push(
    `Git Protection:  .env ignored in .gitignore: ${audit.gitIgnored ? pc.green('✔ Protected') : pc.red('✖ NOT IGNORED (Risk of commit leak!)')}`
  );

  if (audit.leakedKeys.length > 0) {
    notes.push(
      `\n${pc.red(pc.bold('🚨 CRITICAL SECRET LEAK DETECTED IN .env.example:'))}\n` +
        audit.leakedKeys.map((k) => `  ✖ ${pc.bold(pc.red(k))} contains live key signature!`).join('\n')
    );
  } else {
    notes.push(`\nSecret Hygiene:  ${pc.green('✔ Zero live secrets detected in .env.example')}`);
  }

  if (audit.missingInExample.length > 0) {
    notes.push(
      `\n${pc.yellow(`Missing in .env.example (${audit.missingInExample.length} keys):`)}\n` +
        audit.missingInExample.map((k) => `  • ${pc.yellow(k)}`).join('\n') +
        `\n  ${pc.dim('Run `vibe env --sync` to automatically append sanitized placeholders.')}`
    );
  }

  if (audit.missingInEnv.length > 0) {
    notes.push(
      `\n${pc.cyan(`Defined in .env.example but not in your local .env (${audit.missingInEnv.length} keys):`)}\n` +
        audit.missingInEnv.map((k) => `  • ${pc.dim(k)}`).join('\n')
    );
  }

  p.note(notes.join('\n'), 'Environment Sentinel Assessment');

  if (options.check && (audit.leakedKeys.length > 0 || !audit.gitIgnored)) {
    p.outro(pc.red('❌ Environment check failed! Fix the issues above.'));
    process.exitCode = 1;
    return;
  }

  p.outro('Environment security verified. Secrets safely shielded.');
}
