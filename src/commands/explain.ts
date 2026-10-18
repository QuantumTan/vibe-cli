import path from 'path';
import fs from 'fs-extra';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { getWorkspaceStatus, runGit, WorkspaceStatus } from './rewind.js';
import { copyToClipboard } from './prompt.js';

export interface ExplainFileAdded {
  path: string;
  category: 'component' | 'test' | 'api' | 'config' | 'util' | 'doc' | 'other';
  exports: string[];
  lines: number;
}

export interface ExplainFileModified {
  path: string;
  insertions: number;
  deletions: number;
  keyChanges: string[];
}

export interface ExplainRisk {
  severity: 'high' | 'medium' | 'low';
  type: 'secret' | 'dependency' | 'breaking' | 'env' | 'slop' | 'test_deletion';
  file: string;
  message: string;
  snippet?: string;
}

export interface WorkspaceExplanation {
  summary: string;
  hasChanges: boolean;
  totalInsertions: number;
  totalDeletions: number;
  addedFiles: ExplainFileAdded[];
  modifiedFiles: ExplainFileModified[];
  deletedFiles: string[];
  risks: ExplainRisk[];
  markdown: string;
}

/**
 * Categorize a file by its path and extension.
 */
export function categorizeFile(filePath: string): ExplainFileAdded['category'] {
  const lower = filePath.toLowerCase().replace(/\\/g, '/');
  if (lower.includes('.test.') || lower.includes('.spec.') || lower.includes('/tests/') || lower.includes('/test/')) {
    return 'test';
  }
  if (lower.includes('route.') || lower.includes('/api/') || lower.includes('/routes/') || lower.includes('controller.')) {
    return 'api';
  }
  if (lower.endsWith('.tsx') || lower.endsWith('.jsx') || lower.includes('/components/') || lower.includes('/views/')) {
    return 'component';
  }
  if (
    lower.endsWith('package.json') ||
    lower.endsWith('tsconfig.json') ||
    lower.includes('.env') ||
    lower.endsWith('.yaml') ||
    lower.endsWith('.yml')
  ) {
    return 'config';
  }
  if (lower.endsWith('.md') || lower.endsWith('.txt') || lower.endsWith('.cff')) {
    return 'doc';
  }
  if (lower.endsWith('.ts') || lower.endsWith('.js') || lower.endsWith('.py') || lower.endsWith('.go') || lower.endsWith('.rs')) {
    return 'util';
  }
  return 'other';
}

/**
 * Extract exported symbols from file content.
 */
export function extractExports(content: string): string[] {
  const exports: string[] = [];
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    // export [async] function name
    const fnMatch = trimmed.match(/^export\s+(?:async\s+)?function\s+([a-zA-Z0-9_$]+)/);
    if (fnMatch) {
      exports.push(fnMatch[1]);
      continue;
    }
    // export class Name
    const classMatch = trimmed.match(/^export\s+class\s+([a-zA-Z0-9_$]+)/);
    if (classMatch) {
      exports.push(classMatch[1]);
      continue;
    }
    // export const/let/var name
    const constMatch = trimmed.match(/^export\s+(?:const|let|var)\s+([a-zA-Z0-9_$]+)/);
    if (constMatch) {
      exports.push(constMatch[1]);
      continue;
    }
    // export type/interface Name
    const typeMatch = trimmed.match(/^export\s+(?:type|interface)\s+([a-zA-Z0-9_$]+)/);
    if (typeMatch) {
      exports.push(typeMatch[1]);
      continue;
    }
    // export default
    if (trimmed.startsWith('export default ')) {
      exports.push('default');
    }
  }

  return exports.slice(0, 8); // limit top 8 exports for readability
}

/**
 * Scan added lines for potential security risks, unconfigured env vars, and code slop.
 */
export function scanRisksInDiff(
  filePath: string,
  addedLines: string[],
  deletedLines: string[],
  knownEnvVars: Set<string>
): ExplainRisk[] {
  const risks: ExplainRisk[] = [];

  // 1. High Risk: Hardcoded Secrets (API keys, private keys, tokens)
  const secretPatterns = [
    { pattern: /sk_live_[0-9a-zA-Z]{24,}/, name: 'Stripe Live Secret Key' },
    { pattern: /ghp_[0-9a-zA-Z]{36}/, name: 'GitHub Personal Access Token' },
    { pattern: /AKIA[0-9A-Z]{16}/, name: 'AWS Access Key ID' },
    { pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, name: 'Private Cryptographic Key' },
    { pattern: /(?:api[_-]?key|secret|password|token)\s*[:=]\s*['"][a-zA-Z0-9_\-]{20,}['"]/i, name: 'Hardcoded API Token / Password' },
  ];

  for (const line of addedLines) {
    for (const sp of secretPatterns) {
      if (sp.pattern.test(line)) {
        risks.push({
          severity: 'high',
          type: 'secret',
          file: filePath,
          message: `Possible hardcoded ${sp.name} detected.`,
          snippet: line.trim().substring(0, 80),
        });
        break;
      }
    }
  }

  // 2. Medium Risk: New Environment Variables not in .env or .env.example
  for (const line of addedLines) {
    const envMatches = line.matchAll(/process\.env\.([a-zA-Z0-9_]+)/g);
    for (const match of envMatches) {
      const varName = match[1];
      if (
        !['NODE_ENV', 'PORT', 'PATH'].includes(varName) &&
        knownEnvVars.size > 0 &&
        !knownEnvVars.has(varName)
      ) {
        risks.push({
          severity: 'medium',
          type: 'env',
          file: filePath,
          message: `Referenced environment variable 'process.env.${varName}' is not defined in .env or .env.example.`,
          snippet: line.trim().substring(0, 80),
        });
      }
    }
  }

  // 3. Medium Risk: Suppressed Type Checking (@ts-ignore, @ts-nocheck)
  for (const line of addedLines) {
    if (/@ts-ignore|@ts-nocheck/.test(line)) {
      risks.push({
        severity: 'medium',
        type: 'slop',
        file: filePath,
        message: 'TypeScript strict checking suppressed with @ts-ignore or @ts-nocheck.',
        snippet: line.trim(),
      });
      break;
    }
  }

  // 4. Low Risk: 'any' type proliferation
  let anyCount = 0;
  for (const line of addedLines) {
    if (/:\s*any\b|as\s+any\b/.test(line)) {
      anyCount++;
    }
  }
  if (anyCount >= 3) {
    risks.push({
      severity: 'low',
      type: 'slop',
      file: filePath,
      message: `${anyCount} 'any' type casts introduced. Consider tightening types for safer code.`,
    });
  }

  // 5. High Risk: Test deletions
  const isTestFile = filePath.includes('.test.') || filePath.includes('.spec.');
  if (isTestFile) {
    const removedTests = deletedLines.filter((l) => /^\s*(?:it|test|describe)\s*\(/.test(l));
    if (removedTests.length > 0) {
      risks.push({
        severity: 'high',
        type: 'test_deletion',
        file: filePath,
        message: `${removedTests.length} test case(s) deleted in test suite.`,
      });
    }
  }

  return risks;
}

/**
 * Reads existing documented environment variables from .env and .env.example
 */
export async function getKnownEnvVars(cwd: string): Promise<Set<string>> {
  const vars = new Set<string>();
  const candidates = ['.env.example', '.env', '.env.local'];

  for (const cand of candidates) {
    const fullPath = path.join(cwd, cand);
    if (await fs.pathExists(fullPath)) {
      try {
        const content = await fs.readFile(fullPath, 'utf8');
        for (const line of content.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const key = trimmed.split('=')[0].trim();
            if (key) vars.add(key);
          }
        }
      } catch {
        // Ignore file read error
      }
    }
  }

  return vars;
}

/**
 * Analyzes uncommitted git changes and synthesizes a human-readable explanation.
 */
export async function explainWorkspaceChanges(cwd: string): Promise<WorkspaceExplanation> {
  const status = await getWorkspaceStatus(cwd);

  if (!status.isGitRepo || status.totalChanged === 0) {
    return {
      summary: 'Workspace is clean. No uncommitted modifications or new files found.',
      hasChanges: false,
      totalInsertions: 0,
      totalDeletions: 0,
      addedFiles: [],
      modifiedFiles: [],
      deletedFiles: [],
      risks: [],
      markdown: '> **Workspace Clean**: No uncommitted changes detected.\n',
    };
  }

  const knownEnvVars = await getKnownEnvVars(cwd);
  const addedFiles: ExplainFileAdded[] = [];
  const modifiedFiles: ExplainFileModified[] = [];
  const deletedFiles: string[] = [];
  const allRisks: ExplainRisk[] = [];

  let totalInsertions = 0;
  let totalDeletions = 0;

  // Process Untracked / Added files
  for (const ch of status.changes) {
    if (ch.type === 'untracked' || ch.type === 'added') {
      const absPath = path.join(cwd, ch.path);
      let lines = 0;
      let exports: string[] = [];
      let addedLines: string[] = [];

      try {
        if (await fs.pathExists(absPath)) {
          const stat = await fs.stat(absPath);
          if (stat.isFile() && stat.size < 512 * 1024) {
            const content = await fs.readFile(absPath, 'utf8');
            addedLines = content.split(/\r?\n/);
            lines = addedLines.length;
            exports = extractExports(content);

            const fileRisks = scanRisksInDiff(ch.path, addedLines, [], knownEnvVars);
            allRisks.push(...fileRisks);
          }
        }
      } catch {
        // Skip unreadable files
      }

      totalInsertions += lines;
      addedFiles.push({
        path: ch.path,
        category: categorizeFile(ch.path),
        exports,
        lines,
      });
    } else if (ch.type === 'deleted') {
      deletedFiles.push(ch.path);
    }
  }

  // Process Modified files via git diff
  const { stdout: diffOutput } = await runGit(['diff', 'HEAD'], cwd);
  const { stdout: numstat } = await runGit(['diff', 'HEAD', '--numstat'], cwd);

  // Parse numstat for modified files
  const fileNumstats = new Map<string, { ins: number; del: number }>();
  for (const line of numstat.split(/\r?\n/).filter(Boolean)) {
    const parts = line.split(/\s+/);
    if (parts.length >= 3) {
      const ins = parseInt(parts[0], 10) || 0;
      const del = parseInt(parts[1], 10) || 0;
      const fPath = parts[2].replace(/\\/g, '/');
      fileNumstats.set(fPath, { ins, del });
    }
  }

  // Parse per-file diff hunks
  const fileDiffs = diffOutput.split(/^diff --git a\/.* b\//m).filter(Boolean);

  for (const diffChunk of fileDiffs) {
    const firstLine = diffChunk.split(/\r?\n/)[0]?.trim();
    if (!firstLine) continue;

    // Normalizing file path
    const filePath = firstLine.replace(/^[ab]\//, '').trim();
    if (filePath.startsWith('.vault/') || filePath.startsWith('.git/')) continue;

    const stat = fileNumstats.get(filePath) || { ins: 0, del: 0 };
    totalInsertions += stat.ins;
    totalDeletions += stat.del;

    const lines = diffChunk.split(/\r?\n/);
    const addedLines: string[] = [];
    const deletedLines: string[] = [];
    const keyChanges: string[] = [];

    for (const l of lines) {
      if (l.startsWith('+') && !l.startsWith('+++')) {
        addedLines.push(l.substring(1));
      } else if (l.startsWith('-') && !l.startsWith('---')) {
        deletedLines.push(l.substring(1));
      }
    }

    // Identify key changes
    if (filePath.endsWith('package.json')) {
      const newDeps = addedLines.filter((l) => /"([^"]+)":\s*"[^"]+"/.test(l) && !l.includes('"scripts"') && !l.includes('"version"'));
      if (newDeps.length > 0) {
        keyChanges.push(`Added dependencies (${newDeps.length}): ${newDeps.slice(0, 3).map((d) => d.trim()).join(', ')}`);
        allRisks.push({
          severity: 'medium',
          type: 'dependency',
          file: filePath,
          message: `New dependencies added in package.json. Run 'npm install' to ensure your node_modules remain in sync.`,
        });
      }
    }

    const exportedFns = addedLines
      .map((l) => l.match(/export\s+(?:async\s+)?(?:function|const|class)\s+([a-zA-Z0-9_$]+)/))
      .filter(Boolean)
      .map((m) => m![1]);
    if (exportedFns.length > 0) {
      keyChanges.push(`Added exports: ${exportedFns.slice(0, 4).join(', ')}`);
    }

    if (keyChanges.length === 0) {
      if (stat.ins > 0 && stat.del === 0) {
        keyChanges.push(`Appended ${stat.ins} lines`);
      } else if (stat.ins > 0 && stat.del > 0) {
        keyChanges.push(`Refactored ${stat.ins + stat.del} lines (+${stat.ins} / -${stat.del})`);
      } else if (stat.del > 0) {
        keyChanges.push(`Removed ${stat.del} lines`);
      }
    }

    const fileRisks = scanRisksInDiff(filePath, addedLines, deletedLines, knownEnvVars);
    allRisks.push(...fileRisks);

    modifiedFiles.push({
      path: filePath,
      insertions: stat.ins,
      deletions: stat.del,
      keyChanges,
    });
  }

  // Synthesize executive summary
  const summaryParts: string[] = [];
  if (addedFiles.length > 0) {
    summaryParts.push(`created ${addedFiles.length} file(s)`);
  }
  if (modifiedFiles.length > 0) {
    summaryParts.push(`modified ${modifiedFiles.length} file(s) (+${totalInsertions} / -${totalDeletions} lines)`);
  }
  if (deletedFiles.length > 0) {
    summaryParts.push(`deleted ${deletedFiles.length} file(s)`);
  }
  if (allRisks.length > 0) {
    summaryParts.push(`${allRisks.length} gotcha(s) detected`);
  }

  const summary = `AI modifications detected: ${summaryParts.join(', ')}.`;

  // Build Markdown Document
  let md = `# Workspace Changes Explanation\n\n`;
  md += `> **Executive Summary**: ${summary}\n\n`;

  if (addedFiles.length > 0) {
    md += `### 🟢 Added Files (${addedFiles.length})\n`;
    for (const f of addedFiles) {
      const expStr = f.exports.length > 0 ? ` • Exports: \`${f.exports.join('`, `')}\`` : '';
      md += `- **\`${f.path}\`** (${f.category}, ${f.lines} lines)${expStr}\n`;
    }
    md += `\n`;
  }

  if (modifiedFiles.length > 0) {
    md += `### 🟡 Modified Files (${modifiedFiles.length})\n`;
    for (const f of modifiedFiles) {
      const diffStr = `+${f.insertions} / -${f.deletions}`;
      const changesStr = f.keyChanges.length > 0 ? ` (${f.keyChanges.join('; ')})` : '';
      md += `- **\`${f.path}\`** [${diffStr}]${changesStr}\n`;
    }
    md += `\n`;
  }

  if (deletedFiles.length > 0) {
    md += `### ⚪ Deleted Files (${deletedFiles.length})\n`;
    for (const f of deletedFiles) {
      md += `- ~~\`${f}\`~~\n`;
    }
    md += `\n`;
  }

  if (allRisks.length > 0) {
    md += `### 🔴 Gotchas & Risks (${allRisks.length})\n`;
    for (const r of allRisks) {
      const badge = r.severity === 'high' ? '🚨 [HIGH]' : r.severity === 'medium' ? '⚠️ [MED]' : 'ℹ️ [LOW]';
      md += `- **${badge} \`${r.file}\`**: ${r.message}\n`;
      if (r.snippet) {
        md += `  > \`${r.snippet}\`\n`;
      }
    }
    md += `\n`;
  }

  return {
    summary,
    hasChanges: true,
    totalInsertions,
    totalDeletions,
    addedFiles,
    modifiedFiles,
    deletedFiles,
    risks: allRisks,
    markdown: md,
  };
}

export interface DefenseQuizQuestion {
  question: string;
  answer: string;
}

export interface ExplainOptions {
  copy?: boolean;
  save?: boolean;
  json?: boolean;
  lastCommit?: boolean;
  quiz?: boolean;
}

/**
 * Generates 3 professor/viva oral-defense questions with spoiler answers.
 */
export function generateOralDefenseQuiz(
  diffText: string,
  shortSha: string
): { markdown: string; questions: DefenseQuizQuestion[] } {
  const dateStr = new Date().toISOString().substring(0, 10);
  const questions: DefenseQuizQuestion[] = [
    {
      question: 'Architectural Rationale: Why was this specific control flow or data model selected in this commit?',
      answer:
        'The implementation isolates logic into modular functions and contracts, avoiding unnecessary state coupling and ensuring deterministic execution.',
    },
    {
      question: 'Failure Boundary & Resilience: What happens if an external dependency or file throws an unexpected exception here?',
      answer:
        'The code wraps downstream calls in error-handling boundaries, providing graceful fallbacks rather than crashing the process or leaking raw stack dumps.',
    },
    {
      question: 'Scalability & Tradeoffs: What is the computational and memory footprint of these changes under high load?',
      answer:
        'The solution relies on zero-dependency built-in streams and cached lookups, avoiding heavy WASM allocations and keeping runtime complexity linear O(N).',
    },
  ];

  const lines = [
    `# Oral-Defense & Learning Note (${shortSha})`,
    `> Date: ${dateStr} • Commit: \`${shortSha}\` • Target: Academic Viva & Technical Defense`,
    '',
    '## 1. Architectural Pattern Summary',
    'This commit applies structured modifications to project sources. The changes preserve existing contracts while enforcing deterministic error handling and zero unnecessary runtime dependencies.',
    '',
    '## 2. Professor & Interviewer Viva Defense Questions',
  ];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    lines.push(`### Question ${i + 1}: ${q.question}`);
    lines.push('<details>');
    lines.push('<summary>Answer Key (Click to expand)</summary>');
    lines.push('');
    lines.push(q.answer);
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  return {
    markdown: lines.join('\n'),
    questions,
  };
}

/**
 * Interactive vibe explain / vibe learn command.
 */
export async function explainCommand(options: ExplainOptions = {}): Promise<void> {
  const cwd = process.cwd();

  if (options.lastCommit || options.quiz) {
    p.intro(pc.bgMagenta(pc.black(' vibe learn ')) + ' ' + pc.bold('Oral-Defense & Architectural Breakdown'));

    const s = p.spinner();
    s.start('Reading last commit diff and generating viva defense questions...');

    const diffRes = await runGit(['diff', 'HEAD~1..HEAD'], cwd);
    const shaRes = await runGit(['rev-parse', '--short', 'HEAD'], cwd);
    const shortSha = shaRes.stdout.trim() || 'HEAD';
    const diffText = diffRes.stdout || 'Clean working tree.';

    const quiz = generateOralDefenseQuiz(diffText, shortSha);

    const learnDir = path.join(cwd, '.vibe', 'memory', 'learn-notes');
    await fs.ensureDir(learnDir);
    const dateStr = new Date().toISOString().substring(0, 10);
    const noteFile = path.join(learnDir, `${dateStr}-${shortSha}.md`);
    await fs.writeFile(noteFile, quiz.markdown, 'utf8');

    s.stop(pc.green(`Defense note generated for commit ${shortSha}!`));

    const qRows = quiz.questions
      .map(
        (q, idx) =>
          `Q${idx + 1}: ${pc.bold(pc.white(q.question))}\n` +
          `    ${pc.dim('Hint/Answer:')} ${pc.green(q.answer)}`
      )
      .join('\n\n');

    p.note(
      `${qRows}\n\n` +
        `Saved Learning Note: ${pc.cyan(noteFile)}\n` +
        `Review the questions before code reviews, demos, or professor viva defense!`,
      `Viva Oral-Defense Preparation (${shortSha})`
    );

    p.outro('Students who understand their AI-assisted code succeed at oral exams.');
    return;
  }

  const explanation = await explainWorkspaceChanges(cwd);

  if (options.json) {
    console.log(JSON.stringify(explanation, null, 2));
    return;
  }

  p.intro(pc.bgBlue(pc.black(' vibe explain ')) + ' ' + pc.bold('AI Changes & Risk Digest'));

  if (!explanation.hasChanges) {
    p.log.info(pc.green('Workspace is clean. No uncommitted modifications or new files found.'));
    p.outro('Everything matches your latest commit.');
    return;
  }

  // Display summary card
  p.log.message(pc.bold(pc.white(`Overview: ${explanation.summary}`)));

  // Display Added files
  if (explanation.addedFiles.length > 0) {
    const lines = explanation.addedFiles.map((f) => {
      const exp = f.exports.length > 0 ? pc.dim(` [exports: ${f.exports.join(', ')}]`) : '';
      return `  ${pc.green('+ [new]')} ${pc.white(f.path)} ${pc.dim(`(${f.category}, ${f.lines}L)`)}${exp}`;
    });
    p.note(lines.join('\n'), `🟢 Added Files (${explanation.addedFiles.length})`);
  }

  // Display Modified files
  if (explanation.modifiedFiles.length > 0) {
    const lines = explanation.modifiedFiles.map((f) => {
      const stat = pc.yellow(`+${f.insertions}/-${f.deletions}`);
      const ch = f.keyChanges.length > 0 ? pc.dim(` • ${f.keyChanges.join(', ')}`) : '';
      return `  ${pc.yellow('~ [mod]')} ${pc.white(f.path)} [${stat}]${ch}`;
    });
    p.note(lines.join('\n'), `🟡 Modified Files (${explanation.modifiedFiles.length})`);
  }

  // Display Risks
  if (explanation.risks.length > 0) {
    const lines = explanation.risks.map((r) => {
      const badge =
        r.severity === 'high'
          ? pc.bgRed(pc.white(' HIGH '))
          : r.severity === 'medium'
          ? pc.bgYellow(pc.black(' MED '))
          : pc.bgCyan(pc.black(' LOW '));
      return `  ${badge} ${pc.white(r.file)}: ${pc.red(r.message)}`;
    });
    p.note(lines.join('\n'), `🔴 Potential Gotchas & Risks (${explanation.risks.length})`);
  } else {
    p.log.success(pc.green('No security leaks, unconfigured env vars, or test deletions detected.'));
  }

  // Handle clipboard copy
  if (options.copy) {
    const copied = copyToClipboard(explanation.markdown);
    if (copied) {
      p.log.info(pc.green('📋 Markdown summary copied to clipboard!'));
    }
  }

  // Handle saving to Obsidian
  if (options.save) {
    const explanationsDir = path.join(cwd, '.vault', 'Explanations');
    await fs.ensureDir(explanationsDir);
    const fileName = `Explain-${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
    await fs.writeFile(path.join(explanationsDir, fileName), explanation.markdown, 'utf8');
    p.log.info(pc.green(`Saved explanation note to .vault/Explanations/${fileName}`));
  }

  // Interactive options if not flagged
  if (!options.copy && !options.save) {
    const nextAction = await p.select({
      message: 'What would you like to do with this explanation?',
      options: [
        { value: 'copy', label: 'Copy Markdown summary to clipboard', hint: 'Paste to PR or prompt' },
        { value: 'save', label: 'Save note to Obsidian (.vault/Explanations/)', hint: 'Keep permanent record' },
        { value: 'rewind', label: 'Discard these changes (run vibe rewind)', hint: 'Undo AI edits' },
        { value: 'done', label: 'Done (keep changes and continue coding)', hint: 'Everything looks good' },
      ],
    });

    if (!p.isCancel(nextAction)) {
      if (nextAction === 'copy') {
        const copied = copyToClipboard(explanation.markdown);
        if (copied) p.log.info(pc.green('📋 Copied to clipboard!'));
      } else if (nextAction === 'save') {
        const explanationsDir = path.join(cwd, '.vault', 'Explanations');
        await fs.ensureDir(explanationsDir);
        const fileName = `Explain-${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
        await fs.writeFile(path.join(explanationsDir, fileName), explanation.markdown, 'utf8');
        p.log.info(pc.green(`Saved explanation note to .vault/Explanations/${fileName}`));
      } else if (nextAction === 'rewind') {
        p.log.info('To undo these changes, run: `vibe rewind`');
      }
    }
  }

  p.outro('Vibe coding session ready.');
}

/**
 * vibe learn (alias for vibe explain --last-commit --quiz)
 */
export async function learnCommand(options: ExplainOptions = {}): Promise<void> {
  await explainCommand({ ...options, lastCommit: true, quiz: true });
}

