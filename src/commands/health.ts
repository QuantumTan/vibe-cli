import path from 'path';
import fs from 'fs-extra';
import { spawnSync } from 'child_process';
import matter from 'gray-matter';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { getWorkspaceStatus } from './rewind.js';
import { wrapupCommand } from './wrapup.js';
import { generateProjectAgentsMd } from '../templates.js';
import { inspectProject } from '../inspector.js';

export interface HealthCheckItem {
  id: string;
  category: 'Memory & Context' | 'Obsidian & Junction' | 'Type & Build Shield' | 'Token & AST Hygiene' | 'Working Tree';
  name: string;
  status: 'pass' | 'warn' | 'fail';
  score: number;
  maxScore: number;
  message: string;
  fixHint?: string;
  autoFixable?: boolean;
}

export interface HealthReport {
  totalScore: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'Needs Work';
  summary: string;
  checks: HealthCheckItem[];
  oversizedFiles: Array<{ path: string; lines: number }>;
  timestamp: string;
}

/**
 * Scan source directory for files exceeding line threshold (excluding artifacts, deps, vaults).
 */
export async function findOversizedFiles(cwd: string, lineThreshold = 600): Promise<Array<{ path: string; lines: number }>> {
  const oversized: Array<{ path: string; lines: number }> = [];
  const ignoredDirs = new Set(['node_modules', 'dist', 'build', '.git', '.vault', '.vault-global', '.next', 'out', 'coverage', '.cache']);
  const allowedExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.dart', '.cs', '.php', '.go', '.rs']);

  async function walk(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (!ignoredDirs.has(entry.name)) {
            await walk(path.join(dir, entry.name));
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (allowedExts.has(ext)) {
            const fullPath = path.join(dir, entry.name);
            const content = await fs.readFile(fullPath, 'utf8');
            const lines = content.split(/\r?\n/).length;
            if (lines > lineThreshold) {
              const rel = path.relative(cwd, fullPath).replace(/\\/g, '/');
              oversized.push({ path: rel, lines });
            }
          }
        }
      }
    } catch {
      // Ignore unreadable dirs
    }
  }

  await walk(cwd);
  return oversized.sort((a, b) => b.lines - a.lines);
}

/**
 * Run quick type-check on project if TypeScript is detected.
 */
export function checkTypeHealth(cwd: string): { ok: boolean; errorCount: number; message: string } {
  const tsconfigPath = path.join(cwd, 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) {
    return { ok: true, errorCount: 0, message: 'Non-TypeScript project; typecheck skipped.' };
  }

  try {
    const isWin = process.platform === 'win32';
    const cmdStr = isWin ? 'npx.cmd tsc --noEmit' : 'npx tsc --noEmit';
    const res = spawnSync(cmdStr, {
      cwd,
      encoding: 'utf8',
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 20000,
    });

    if (res.status === 0) {
      return { ok: true, errorCount: 0, message: 'TypeScript strict check passed with 0 errors.' };
    }

    const output = (res.stdout || '') + (res.stderr || '');
    const errorMatches = output.match(/error TS[0-9]+/g);
    const count = errorMatches ? errorMatches.length : 1;
    return {
      ok: false,
      errorCount: count,
      message: `${count} TypeScript error(s) detected. Run 'vibe triage' to resolve.`,
    };
  } catch {
    return { ok: true, errorCount: 0, message: 'Typecheck toolchain skipped or timed out.' };
  }
}

/**
 * Evaluates the AI readiness score of the workspace.
 */
export async function evaluateVibeHealth(cwd: string): Promise<HealthReport> {
  const checks: HealthCheckItem[] = [];

  // 1. Memory Bank & Context Hygiene (Max 30 pts)
  const contextPath = path.join(cwd, '.vault', '_Context.md');
  const contextExists = await fs.pathExists(contextPath);

  if (contextExists) {
    checks.push({
      id: 'context_exists',
      category: 'Memory & Context',
      name: 'Project Context Hub (_Context.md)',
      status: 'pass',
      score: 10,
      maxScore: 10,
      message: 'Active context hub present in .vault/_Context.md.',
    });

    try {
      const raw = await fs.readFile(contextPath, 'utf8');
      const lines = raw.split(/\r?\n/).length;
      if (lines <= 60) {
        checks.push({
          id: 'context_length',
          category: 'Memory & Context',
          name: 'Context Token Density (<= 60 lines)',
          status: 'pass',
          score: 10,
          maxScore: 10,
          message: `Optimal token density: ${lines}/60 lines. Prompt context is fast and focused.`,
        });
      } else if (lines <= 90) {
        checks.push({
          id: 'context_length',
          category: 'Memory & Context',
          name: 'Context Token Density (<= 60 lines)',
          status: 'warn',
          score: 5,
          maxScore: 10,
          message: `Context is growing (${lines} lines). Exceeds recommended 60-line sliding window.`,
          fixHint: 'Run `vibe wrapup` to archive finished tasks and prune context.',
          autoFixable: true,
        });
      } else {
        checks.push({
          id: 'context_length',
          category: 'Memory & Context',
          name: 'Context Token Density (<= 60 lines)',
          status: 'fail',
          score: 0,
          maxScore: 10,
          message: `Context is bloated (${lines} lines). Risk of AI context rot and hallucinations.`,
          fixHint: 'Run `vibe wrapup` immediately to prune completed tasks.',
          autoFixable: true,
        });
      }
    } catch {
      checks.push({
        id: 'context_length',
        category: 'Memory & Context',
        name: 'Context Token Density',
        status: 'warn',
        score: 5,
        maxScore: 10,
        message: 'Unable to parse _Context.md line count.',
      });
    }
  } else {
    checks.push({
      id: 'context_exists',
      category: 'Memory & Context',
      name: 'Project Context Hub (_Context.md)',
      status: 'fail',
      score: 0,
      maxScore: 10,
      message: 'No .vault/_Context.md found. AI agents lack session memory.',
      fixHint: 'Run `vibe link` to wire project and initialize memory bank.',
      autoFixable: false,
    });
    checks.push({
      id: 'context_length',
      category: 'Memory & Context',
      name: 'Context Token Density',
      status: 'fail',
      score: 0,
      maxScore: 10,
      message: 'Missing context hub.',
    });
  }

  // Check Lessons & Gotchas
  const lessonsPath = path.join(cwd, '.vault', 'Memory-Bank', 'Lessons-and-Gotchas.md');
  const lessonsExists = await fs.pathExists(lessonsPath);
  if (lessonsExists) {
    const content = await fs.readFile(lessonsPath, 'utf8');
    const hasEntries = content.includes('- [') || content.includes('## ');
    checks.push({
      id: 'memory_lessons',
      category: 'Memory & Context',
      name: 'Lessons & Gotchas Archive',
      status: 'pass',
      score: 5,
      maxScore: 5,
      message: hasEntries
        ? 'Historical learnings and bug patterns logged in Memory-Bank.'
        : 'Lessons-and-Gotchas.md ready for bug logging with `vibe snap`.',
    });
  } else {
    checks.push({
      id: 'memory_lessons',
      category: 'Memory & Context',
      name: 'Lessons & Gotchas Archive',
      status: 'warn',
      score: 2,
      maxScore: 5,
      message: 'No Lessons-and-Gotchas.md found in .vault/Memory-Bank/.',
      fixHint: 'Run `vibe snap "lesson"` to record your first architectural bug fix.',
      autoFixable: false,
    });
  }

  // Check AGENTS.md
  const agentsPath = path.join(cwd, 'AGENTS.md');
  const agentsExists = await fs.pathExists(agentsPath);
  if (agentsExists) {
    checks.push({
      id: 'agents_md',
      category: 'Memory & Context',
      name: 'AI Directives (AGENTS.md)',
      status: 'pass',
      score: 5,
      maxScore: 5,
      message: 'Root AGENTS.md present with platform rules and memory sync directives.',
    });
  } else {
    checks.push({
      id: 'agents_md',
      category: 'Memory & Context',
      name: 'AI Directives (AGENTS.md)',
      status: 'fail',
      score: 0,
      maxScore: 5,
      message: 'Missing root AGENTS.md. Coding agents will lack system rules.',
      fixHint: 'Run `vibe link` or `vibe health --fix` to scaffold AGENTS.md.',
      autoFixable: true,
    });
  }

  // 2. Obsidian Live Junction & Vault (Max 20 pts)
  const vaultDir = path.join(cwd, '.vault');
  const vaultDirExists = await fs.pathExists(vaultDir);

  if (vaultDirExists) {
    checks.push({
      id: 'vault_dir',
      category: 'Obsidian & Junction',
      name: 'Obsidian Project Vault (.vault/)',
      status: 'pass',
      score: 10,
      maxScore: 10,
      message: '.vault/ folder present in project root.',
    });

    let isJunction = false;
    try {
      const stats = await fs.lstat(vaultDir);
      isJunction = stats.isSymbolicLink();
    } catch {
      // ignore
    }

    if (isJunction) {
      checks.push({
        id: 'junction_alive',
        category: 'Obsidian & Junction',
        name: 'NTFS Directory Junction',
        status: 'pass',
        score: 10,
        maxScore: 10,
        message: 'Active zero-copy NTFS directory junction connected to Obsidian.',
      });
    } else {
      checks.push({
        id: 'junction_alive',
        category: 'Obsidian & Junction',
        name: 'NTFS Directory Junction',
        status: 'warn',
        score: 5,
        maxScore: 10,
        message: '.vault/ is a standard folder, not an NTFS junction. Obsidian vault won\'t auto-sync.',
        fixHint: 'Run `vibe link` to wire a live NTFS junction to your central Obsidian vault.',
      });
    }
  } else {
    checks.push({
      id: 'vault_dir',
      category: 'Obsidian & Junction',
      name: 'Obsidian Project Vault (.vault/)',
      status: 'fail',
      score: 0,
      maxScore: 10,
      message: 'No .vault/ directory found.',
      fixHint: 'Run `vibe link` to connect this project to Obsidian.',
    });
    checks.push({
      id: 'junction_alive',
      category: 'Obsidian & Junction',
      name: 'NTFS Directory Junction',
      status: 'fail',
      score: 0,
      maxScore: 10,
      message: 'Junction disconnected.',
    });
  }

  // 3. Type & Build Shield (Max 25 pts)
  const typeResult = checkTypeHealth(cwd);
  if (typeResult.ok) {
    checks.push({
      id: 'type_health',
      category: 'Type & Build Shield',
      name: 'Type Check & Compiler Shield',
      status: 'pass',
      score: 25,
      maxScore: 25,
      message: typeResult.message,
    });
  } else {
    checks.push({
      id: 'type_health',
      category: 'Type & Build Shield',
      name: 'Type Check & Compiler Shield',
      status: 'fail',
      score: 0,
      maxScore: 25,
      message: typeResult.message,
      fixHint: 'Run `vibe triage` to slice errors and generate surgical AI fix prompts.',
    });
  }

  // 4. Token & AST Hygiene: Oversized files (Max 15 pts)
  const oversized = await findOversizedFiles(cwd, 600);
  if (oversized.length === 0) {
    checks.push({
      id: 'token_hygiene',
      category: 'Token & AST Hygiene',
      name: 'File Size & Token Density (< 600 lines)',
      status: 'pass',
      score: 15,
      maxScore: 15,
      message: 'All source files under 600 lines. Clean prompt context windows.',
    });
  } else if (oversized.length <= 2) {
    checks.push({
      id: 'token_hygiene',
      category: 'Token & AST Hygiene',
      name: 'File Size & Token Density (< 600 lines)',
      status: 'warn',
      score: 10,
      maxScore: 15,
      message: `${oversized.length} oversized file(s) found (${oversized.map((o) => `${o.path} [${o.lines}L]`).join(', ')}).`,
      fixHint: 'Use `vibe pack <file> -s` to compress exports into AST signatures.',
    });
  } else {
    checks.push({
      id: 'token_hygiene',
      category: 'Token & AST Hygiene',
      name: 'File Size & Token Density (< 600 lines)',
      status: 'fail',
      score: 5,
      maxScore: 15,
      message: `${oversized.length} files exceed 600 lines. Causes prompt bloat and token exhaustion.`,
      fixHint: 'Split large modules or use `vibe pack -s` for compact context signatures.',
    });
  }

  // 5. Working Tree State (Max 10 pts)
  const status = await getWorkspaceStatus(cwd);
  if (!status.isGitRepo) {
    checks.push({
      id: 'git_status',
      category: 'Working Tree',
      name: 'Git Version Safety',
      status: 'warn',
      score: 5,
      maxScore: 10,
      message: 'Workspace is not a git repository. Rollbacks and diff tracking unavailable.',
      fixHint: 'Run `git init` to enable 1-click `vibe rewind`.',
    });
  } else if (status.totalChanged === 0) {
    checks.push({
      id: 'git_status',
      category: 'Working Tree',
      name: 'Clean Git Working State',
      status: 'pass',
      score: 10,
      maxScore: 10,
      message: 'Working tree clean. All changes committed.',
    });
  } else {
    checks.push({
      id: 'git_status',
      category: 'Working Tree',
      name: 'Uncommitted AI Changes',
      status: 'warn',
      score: 7,
      maxScore: 10,
      message: `${status.totalChanged} uncommitted file change(s) in working tree.`,
      fixHint: 'Run `vibe explain` to inspect changes, or `vibe commit` to save.',
    });
  }

  // Calculate Total Score and Grade
  const totalScore = checks.reduce((sum, c) => sum + c.score, 0);

  let grade: HealthReport['grade'] = 'Needs Work';
  if (totalScore >= 90) grade = 'A+';
  else if (totalScore >= 80) grade = 'A';
  else if (totalScore >= 70) grade = 'B';
  else if (totalScore >= 55) grade = 'C';

  let summary = '';
  if (grade === 'A+' || grade === 'A') {
    summary = 'Optimal Vibe State ⚡ Workspace is primed for fast, accurate AI coding sessions.';
  } else if (grade === 'B') {
    summary = 'Good Vibe State ✨ Minor context or type warnings detected.';
  } else {
    summary = 'Degraded Vibe State ⚠️ Context bloat or missing memory bank increases AI hallucination risk.';
  }

  return {
    totalScore,
    grade,
    summary,
    checks,
    oversizedFiles: oversized,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Execute automated non-destructive repairs.
 */
export async function executeAutoFix(cwd: string): Promise<string[]> {
  const fixesApplied: string[] = [];

  // 1. Prune _Context.md if oversized
  const contextPath = path.join(cwd, '.vault', '_Context.md');
  if (await fs.pathExists(contextPath)) {
    try {
      const raw = await fs.readFile(contextPath, 'utf8');
      if (raw.split(/\r?\n/).length > 60) {
        await wrapupCommand();
        fixesApplied.push('Pruned completed tasks and trimmed .vault/_Context.md under 60 lines.');
      }
    } catch {
      // ignore
    }
  }

  // 2. Generate AGENTS.md if missing
  const agentsPath = path.join(cwd, 'AGENTS.md');
  if (!(await fs.pathExists(agentsPath))) {
    try {
      const meta = await inspectProject(cwd);
      const content = generateProjectAgentsMd(meta);
      await fs.writeFile(agentsPath, content, 'utf8');
      fixesApplied.push('Generated root AGENTS.md with strict platform rules and memory sync directives.');
    } catch {
      // ignore
    }
  }

  // 3. Create .env.example if missing and .env exists
  const envPath = path.join(cwd, '.env');
  const envExPath = path.join(cwd, '.env.example');
  if ((await fs.pathExists(envPath)) && !(await fs.pathExists(envExPath))) {
    try {
      const rawEnv = await fs.readFile(envPath, 'utf8');
      const sanitized = rawEnv
        .split(/\r?\n/)
        .map((l) => {
          const t = l.trim();
          if (!t || t.startsWith('#')) return l;
          if (t.includes('=')) {
            const [k] = t.split('=');
            return `${k}=your_${k.toLowerCase()}_here`;
          }
          return l;
        })
        .join('\n');
      await fs.writeFile(envExPath, sanitized, 'utf8');
      fixesApplied.push('Scaffolded sanitized .env.example template for secure collaboration.');
    } catch {
      // ignore
    }
  }

  return fixesApplied;
}

/**
 * Interactive vibe health command.
 */
export async function healthCommand(
  options: {
    fix?: boolean;
    json?: boolean;
  } = {}
): Promise<void> {
  const cwd = process.cwd();

  if (options.fix) {
    p.intro(pc.bgGreen(pc.black(' vibe health --fix ')) + ' ' + pc.bold('Autonomous Workspace Repair'));
    const s = p.spinner();
    s.start('Running non-destructive workspace repairs...');
    const applied = await executeAutoFix(cwd);
    s.stop(pc.green(`Repairs completed (${applied.length} fix(es) applied)`));
    for (const f of applied) {
      p.log.success(f);
    }
    p.log.info('Re-evaluating health score...');
  }

  const report = await evaluateVibeHealth(cwd);

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (!options.fix) {
    p.intro(pc.bgCyan(pc.black(' vibe health ')) + ' ' + pc.bold('AI Readiness Score & Vibe Diagnostic'));
  }

  // Render Meter Card
  const scoreColor = report.totalScore >= 80 ? pc.green : report.totalScore >= 60 ? pc.yellow : pc.red;
  const barLen = 30;
  const filled = Math.round((report.totalScore / 100) * barLen);
  const progressBar = scoreColor('█'.repeat(filled)) + pc.dim('░'.repeat(barLen - filled));

  p.note(
    `  ${scoreColor(pc.bold(`${report.totalScore}/100`))} ${pc.bold(`(Grade: ${report.grade})`)}\n` +
      `  [${progressBar}]\n\n` +
      `  ${pc.white(report.summary)}`,
    'Vibe Coding Readiness Meter'
  );

  // Group checks by category
  const categories = [
    'Memory & Context',
    'Obsidian & Junction',
    'Type & Build Shield',
    'Token & AST Hygiene',
    'Working Tree',
  ] as const;

  for (const cat of categories) {
    const catChecks = report.checks.filter((c) => c.category === cat);
    if (catChecks.length === 0) continue;

    const lines = catChecks.map((c) => {
      const icon = c.status === 'pass' ? pc.green('✔') : c.status === 'warn' ? pc.yellow('▲') : pc.red('✖');
      const scoreStr = pc.dim(`(${c.score}/${c.maxScore} pts)`);
      const hint = c.fixHint ? `\n    ${pc.cyan('↳')} ${pc.dim(c.fixHint)}` : '';
      return `  ${icon} ${pc.white(c.name)} ${scoreStr}\n    ${pc.dim(c.message)}${hint}`;
    });

    p.note(lines.join('\n\n'), cat);
  }

  // Show fix prompt if actionable items exist and not in fix mode
  const fixable = report.checks.filter((c) => c.fixHint);
  if (fixable.length > 0 && !options.fix) {
    p.log.info(pc.cyan('⚡ Tip: Run `vibe health --fix` to automatically repair fixable items.'));
  }

  p.outro(pc.green(`Health evaluation complete. Happy vibe coding!`));
}
