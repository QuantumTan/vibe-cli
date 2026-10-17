import path from 'path';
import fs from 'fs-extra';
import { spawn } from 'child_process';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { inspectProject } from '../inspector.js';
import { copyToClipboard } from './prompt.js';

export interface TriageResult {
  passed: boolean;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  failedFiles: Array<{ file: string; line?: number; message?: string }>;
  snippet?: string;
  surgicalPrompt: string;
}

export function parseErrorTrace(output: string): Array<{ file: string; line?: number; message?: string }> {
  const findings: Array<{ file: string; line?: number; message?: string }> = [];
  const lines = output.split('\n');

  // Pattern 1: TypeScript compiler errors: src/index.ts:42:15 - error TS2304: ... or src/index.ts(15,20): error TS...
  const tsErrorRegex = /([a-zA-Z0-9_\-\\/.]+\.[a-zA-Z0-9]+)[:\(](\d+)(?:[,:](\d+)\)?)?:?\s*(?:-\s*)?error\s*(?:[A-Z0-9]+)?:\s*(.+)/i;
  // Pattern 2: Vitest / Jest stack trace: at Object.<anonymous> (tests/index.test.ts:42:15)
  const vitestStackRegex = /at\s+.*?\(([a-zA-Z0-9_\-\\/.]+\.[a-zA-Z0-9]+):(\d+):(\d+)\)/;
  // Pattern 3: Vitest FAIL line: FAIL tests/index.test.ts > suite > test
  const vitestFailRegex = /FAIL\s+([a-zA-Z0-9_\-\\/.]+\.[a-zA-Z0-9]+)/;
  // Pattern 4: Python traceback: File "app.py", line 42, in ...
  const pyTraceRegex = /File\s+["']([^"']+)["'],\s+line\s+(\d+)(?:,\s+in\s+(.+))?/;

  for (const line of lines) {
    const trimmed = line.trim();

    let match = trimmed.match(tsErrorRegex);
    if (match) {
      findings.push({
        file: match[1],
        line: parseInt(match[2], 10),
        message: match[4]?.trim(),
      });
      continue;
    }

    match = trimmed.match(vitestStackRegex);
    if (match) {
      findings.push({
        file: match[1],
        line: parseInt(match[2], 10),
      });
      continue;
    }

    match = trimmed.match(pyTraceRegex);
    if (match) {
      findings.push({
        file: match[1],
        line: parseInt(match[2], 10),
        message: match[3]?.trim(),
      });
      continue;
    }

    match = trimmed.match(vitestFailRegex);
    if (match) {
      findings.push({
        file: match[1],
        message: trimmed,
      });
    }
  }

  // Deduplicate by file
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.file}:${f.line || 0}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function generateSurgicalPrompt(
  command: string,
  errorOutput: string,
  findings: Array<{ file: string; line?: number; message?: string }>,
  codeSnippet?: string,
  recentLessons?: string
): string {
  const primaryFinding = findings[0] || { file: 'Unknown File' };
  const lines: string[] = [
    `# 🚨 SURGICAL ERROR RECOVERY DIRECTIVE`,
    `> **Failed Verification**: \`${command}\` • **Target**: \`${primaryFinding.file}\`${primaryFinding.line ? ` (Line ${primaryFinding.line})` : ''}`,
    '',
    `## 1. Error Summary`,
    '```text',
    errorOutput.slice(-1500).trim(), // Last 1500 characters of trace
    '```',
    '',
  ];

  if (findings.length > 0) {
    lines.push(`## 2. Identified Offending Locations`);
    for (const f of findings.slice(0, 5)) {
      lines.push(`- **\`${f.file}\`**${f.line ? ` (Line ${f.line})` : ''}${f.message ? `: ${f.message}` : ''}`);
    }
    lines.push('');
  }

  if (codeSnippet) {
    lines.push(`## 3. Offending Source Code Context`);
    lines.push('```typescript');
    lines.push(codeSnippet);
    lines.push('```');
    lines.push('');
  }

  if (recentLessons) {
    lines.push(`## 4. Past Lessons & Gotchas from Memory Bank`);
    lines.push(recentLessons.trim());
    lines.push('');
  }

  lines.push(`## 5. Strict Anti-Slop Fix Directives`);
  lines.push(`1. **Surgical repair**: Fix the exact root cause identified in the stack trace above.`);
  lines.push(`2. **Zero unrelated modifications**: Do NOT refactor or delete unrelated working logic.`);
  lines.push(`3. **Verify immediately**: Ensure \`${command}\` passes with 0 errors after your fix.`);

  return lines.join('\n');
}

/**
 * Runs verification command and extracts surgical error context if it fails.
 */
export async function runTriage(cwd: string, customCmd?: string): Promise<TriageResult> {
  const meta = await inspectProject(cwd);
  const command = customCmd || meta.verifyCmd;

  return new Promise((resolve) => {
    const parts = command.split(' ');
    const child = spawn(parts[0], parts.slice(1), { cwd, shell: true });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));

    child.on('close', async (code) => {
      const passed = code === 0;
      const combined = (stdout + '\n' + stderr).trim();

      if (passed) {
        return resolve({
          passed: true,
          command,
          exitCode: 0,
          stdout,
          stderr,
          failedFiles: [],
          surgicalPrompt: '',
        });
      }

      const findings = parseErrorTrace(combined);
      let snippet: string | undefined;

      if (findings.length > 0 && findings[0].file) {
        const absFile = path.resolve(cwd, findings[0].file);
        if (await fs.pathExists(absFile)) {
          try {
            const content = await fs.readFile(absFile, 'utf8');
            const fileLines = content.split('\n');
            const lineNum = findings[0].line || 1;
            const start = Math.max(0, lineNum - 10);
            const end = Math.min(fileLines.length, lineNum + 10);
            snippet = fileLines
              .slice(start, end)
              .map((l, i) => `${start + i + 1}: ${l}`)
              .join('\n');
          } catch {
            // Ignore snippet read error
          }
        }
      }

      // Check for recent gotchas in .vault/Memory-Bank/Lessons-and-Gotchas.md
      let recentLessons: string | undefined;
      const lessonsPath = path.join(cwd, '.vault', 'Memory-Bank', 'Lessons-and-Gotchas.md');
      if (await fs.pathExists(lessonsPath)) {
        try {
          const lContent = await fs.readFile(lessonsPath, 'utf8');
          recentLessons = lContent.slice(-800); // Last 800 chars
        } catch {
          // Ignore
        }
      }

      const surgicalPrompt = generateSurgicalPrompt(command, combined, findings, snippet, recentLessons);

      resolve({
        passed: false,
        command,
        exitCode: code ?? 1,
        stdout,
        stderr,
        failedFiles: findings,
        snippet,
        surgicalPrompt,
      });
    });

    child.on('error', (err) => {
      resolve({
        passed: false,
        command,
        exitCode: 1,
        stdout: '',
        stderr: err.message,
        failedFiles: [],
        surgicalPrompt: generateSurgicalPrompt(command, err.message, []),
      });
    });
  });
}

/**
 * vibe triage [customCommand]
 */
export async function triageCommand(customCommand?: string): Promise<void> {
  const cwd = process.cwd();
  p.intro(pc.bgRed(pc.white(' vibe triage ')) + ' ' + pc.bold('Autonomous AI Failure Triage & Self-Healing'));

  const s = p.spinner();
  s.start('Running project verification suite to inspect errors...');

  const result = await runTriage(cwd, customCommand);

  if (result.passed) {
    s.stop(pc.green(`✔ Verification suite passed cleanly (\`${result.command}\`)! Zero errors found.`));
    p.outro(pc.green('Codebase is healthy. Ready to continue coding.'));
    return;
  }

  s.stop(pc.red(`✖ Verification failed (\`${result.command}\` exited with code ${result.exitCode})`));

  // Save surgical prompt to .vault/Triage/Error-Report.md
  const triageDir = path.join(cwd, '.vault', 'Triage');
  await fs.ensureDir(triageDir);
  const reportPath = path.join(triageDir, 'Error-Report.md');
  await fs.writeFile(reportPath, result.surgicalPrompt, 'utf8');

  // Copy surgical prompt to clipboard
  const copied = await copyToClipboard(result.surgicalPrompt);

  p.note(
    `Failed Files:    ${pc.bold(pc.red(result.failedFiles.map((f) => f.file + (f.line ? `:${f.line}` : '')).join(', ') || 'See error trace'))}\n` +
      `Report File:     ${pc.white(reportPath)}\n` +
      `Clipboard:       ${copied ? pc.green('✔ Surgical Fix Prompt Copied to Clipboard!') : pc.dim('Clipboard unavailable')}\n\n` +
      `Simply paste into Antigravity or Cursor. The AI agent will receive the exact broken line, stack trace, and fix directives.`,
    'Triage Analysis Ready'
  );

  p.outro('Feed the copied prompt to your AI agent for a 1-shot surgical fix!');
}
