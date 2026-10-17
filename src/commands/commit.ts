import path from 'path';
import fs from 'fs-extra';
import { spawn } from 'child_process';
import * as p from '@clack/prompts';
import pc from 'picocolors';

export interface DiffAnalysis {
  staged: boolean;
  filesChanged: string[];
  insertions: number;
  deletions: number;
  rawDiff: string;
}

export interface ConventionalCommitProposal {
  type: 'feat' | 'fix' | 'refactor' | 'docs' | 'test' | 'perf' | 'chore';
  scope: string;
  subject: string;
  body: string[];
  fullMessage: string;
}

function runGit(args: string[], cwd: string): Promise<{ stdout: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn('git', args, { cwd });
    let stdout = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.on('close', (code) => resolve({ stdout: stdout.trim(), code: code ?? 1 }));
    child.on('error', () => resolve({ stdout: '', code: 1 }));
  });
}

/**
 * Analyzes git diff for staged or working tree changes.
 */
export async function analyzeGitDiff(cwd: string): Promise<DiffAnalysis> {
  // First check staged changes
  let { stdout: stagedDiff } = await runGit(['diff', '--cached'], cwd);
  let staged = true;

  if (!stagedDiff) {
    // If no staged changes, check unstaged
    const { stdout: workingDiff } = await runGit(['diff'], cwd);
    stagedDiff = workingDiff;
    staged = false;
  }

  const { stdout: numstat } = await runGit(
    staged ? ['diff', '--cached', '--numstat'] : ['diff', '--numstat'],
    cwd
  );

  const filesChanged: string[] = [];
  let insertions = 0;
  let deletions = 0;

  for (const line of numstat.split('\n').filter(Boolean)) {
    const parts = line.split(/\s+/);
    if (parts.length >= 3) {
      insertions += parseInt(parts[0], 10) || 0;
      deletions += parseInt(parts[1], 10) || 0;
      filesChanged.push(parts[2]);
    }
  }

  return {
    staged,
    filesChanged,
    insertions,
    deletions,
    rawDiff: stagedDiff,
  };
}

/**
 * Synthesizes a conventional commit proposal based on diff heuristics.
 */
export function synthesizeConventionalCommit(diff: DiffAnalysis): ConventionalCommitProposal {
  if (diff.filesChanged.length === 0) {
    return {
      type: 'chore',
      scope: 'workspace',
      subject: 'maintenance and minor updates',
      body: [],
      fullMessage: 'chore(workspace): maintenance and minor updates',
    };
  }

  let type: ConventionalCommitProposal['type'] = 'feat';
  const fileNames = diff.filesChanged.map((f) => f.toLowerCase());

  // Determine type
  if (fileNames.every((f) => f.includes('test') || f.includes('spec'))) {
    type = 'test';
  } else if (fileNames.every((f) => f.endsWith('.md') || f.includes('docs/'))) {
    type = 'docs';
  } else if (diff.rawDiff.includes('fix') || diff.rawDiff.includes('bug') || diff.rawDiff.includes('error')) {
    type = 'fix';
  } else if (diff.rawDiff.includes('refactor') || (diff.deletions > diff.insertions && diff.deletions > 50)) {
    type = 'refactor';
  } else if (fileNames.every((f) => f.includes('config') || f.includes('package.json') || f.includes('.gitignore'))) {
    type = 'chore';
  }

  // Determine scope
  let scope = 'core';
  const firstFile = diff.filesChanged[0];
  if (firstFile.includes('billing') || firstFile.includes('stripe') || firstFile.includes('monetize')) {
    scope = 'billing';
  } else if (firstFile.includes('auth') || firstFile.includes('login') || firstFile.includes('user')) {
    scope = 'auth';
  } else if (firstFile.includes('skills/') || firstFile.includes('skill')) {
    scope = 'skills';
  } else if (firstFile.includes('vault') || firstFile.includes('obsidian')) {
    scope = 'vault';
  } else if (firstFile.includes('api/') || firstFile.includes('routes/')) {
    scope = 'api';
  } else if (firstFile.includes('tests/')) {
    scope = 'tests';
  } else {
    const dir = path.dirname(firstFile);
    if (dir && dir !== '.') scope = path.basename(dir);
  }

  // Generate body bullets
  const bodyBullets: string[] = [];
  const primaryFiles = diff.filesChanged.slice(0, 5);
  for (const f of primaryFiles) {
    const base = path.basename(f);
    bodyBullets.push(`update ${base} implementation and logic`);
  }

  const subject =
    type === 'feat'
      ? `implement new ${scope} capabilities and enhancements`
      : type === 'fix'
      ? `resolve issue in ${scope} module`
      : type === 'test'
      ? `add test suites for ${scope} verification`
      : type === 'docs'
      ? `update documentation and references for ${scope}`
      : `update ${scope} components and configurations`;

  const fullMessage = `${type}(${scope}): ${subject}\n\n` + bodyBullets.map((b) => `- ${b}`).join('\n');

  return {
    type,
    scope,
    subject,
    body: bodyBullets,
    fullMessage,
  };
}

/**
 * Appends entry to CHANGELOG.md and .vault/Changelog.md
 */
export async function appendToChangelog(cwd: string, proposal: ConventionalCommitProposal): Promise<string[]> {
  const dateStr = new Date().toISOString().substring(0, 10);
  const updated: string[] = [];

  const entry = `\n### [${dateStr}] ${proposal.type}(${proposal.scope}): ${proposal.subject}\n` +
    proposal.body.map((b) => `- ${b}`).join('\n') + '\n';

  const paths = [
    path.join(cwd, '.vault', 'Changelog.md'),
    path.join(cwd, 'CHANGELOG.md'),
  ];

  for (const pth of paths) {
    try {
      if (await fs.pathExists(pth)) {
        const existing = await fs.readFile(pth, 'utf8');
        await fs.writeFile(pth, existing + entry, 'utf8');
        updated.push(path.relative(cwd, pth).replace(/\\/g, '/'));
      } else if (pth.includes('.vault') && (await fs.pathExists(path.join(cwd, '.vault')))) {
        await fs.writeFile(pth, `# Project Changelog\n${entry}`, 'utf8');
        updated.push(path.relative(cwd, pth).replace(/\\/g, '/'));
      }
    } catch {
      // Ignore write errors
    }
  }

  return updated;
}

/**
 * vibe commit [message]
 */
export async function commitCommand(messageInput?: string): Promise<void> {
  const cwd = process.cwd();
  p.intro(pc.bgCyan(pc.black(' vibe commit ')) + ' ' + pc.bold('Semantic Conventional Commit & Changelog Engine'));

  const s = p.spinner();
  s.start('Analyzing git diff and modified files...');

  const diff = await analyzeGitDiff(cwd);

  if (diff.filesChanged.length === 0) {
    s.stop(pc.yellow('Working directory is clean. No changes to commit.'));
    p.outro('Nothing to commit.');
    return;
  }

  const proposal = messageInput
    ? {
        type: 'feat' as const,
        scope: 'app',
        subject: messageInput,
        body: [],
        fullMessage: messageInput,
      }
    : synthesizeConventionalCommit(diff);

  s.stop(pc.green(`Analyzed ${diff.filesChanged.length} file(s) (+${diff.insertions} / -${diff.deletions})`));

  p.note(
    `Proposed Commit Message:\n\n${pc.bold(pc.green(proposal.fullMessage))}\n\n` +
      `Files Changed (${diff.filesChanged.length}):\n` +
      diff.filesChanged.slice(0, 8).map((f) => `  • ${pc.cyan(f)}`).join('\n') +
      (diff.filesChanged.length > 8 ? `\n  ... and ${diff.filesChanged.length - 8} more` : ''),
    'Commit Proposal'
  );

  const action = await p.select({
    message: 'Action:',
    options: [
      { value: 'commit', label: '✅ Accept, Commit & Update Changelog' },
      { value: 'edit', label: '✏️  Edit Commit Message' },
      { value: 'cancel', label: '❌ Cancel' },
    ],
  });

  if (p.isCancel(action) || action === 'cancel') {
    p.cancel('Commit aborted.');
    return;
  }

  let finalMessage = proposal.fullMessage;

  if (action === 'edit') {
    const edited = await p.text({
      message: 'Enter commit message:',
      defaultValue: proposal.fullMessage.split('\n')[0],
      validate: (v) => (!v?.trim() ? 'Message cannot be empty' : undefined),
    });
    if (p.isCancel(edited)) return;
    finalMessage = edited.trim();
  }

  // If changes were not staged, stage them
  if (!diff.staged) {
    await runGit(['add', '.'], cwd);
  }

  // Append to Changelog
  await appendToChangelog(cwd, proposal);

  // Commit
  const commitResult = await runGit(['commit', '-m', finalMessage], cwd);

  if (commitResult.code === 0) {
    p.outro(pc.green(`🎉 Successfully committed: "${finalMessage.split('\n')[0]}"!`));
  } else {
    p.log.error(commitResult.stdout || 'Git commit failed.');
    p.outro('Commit error.');
  }
}
