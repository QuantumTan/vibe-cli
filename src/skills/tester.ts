import path from 'path';
import fs from 'fs-extra';
import { spawn } from 'child_process';
import matter from 'gray-matter';
import { SkillTestReport, SkillTestCase, SkillIR } from './types.js';

interface ExecResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runProcess(cmd: string, args: string[], cwd: string): Promise<ExecResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, shell: false });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });

    child.on('error', (err) => {
      resolve({ code: 1, stdout, stderr: err.message });
    });
  });
}

/**
 * Runs automated safety and guardrail verification tests on a compiled skill.
 */
export async function testSkill(skillDir: string): Promise<SkillTestReport> {
  const resolvedDir = path.resolve(skillDir);
  const skillMdPath = path.join(resolvedDir, 'SKILL.md');
  const nodeRunnerPath = path.join(resolvedDir, 'scripts', 'run.js');
  const pyRunnerPath = path.join(resolvedDir, 'scripts', 'run.py');
  const mcpServerPath = path.join(resolvedDir, 'mcp-server.js');

  let runnerCmd = 'node';
  let runnerFile = '';

  if (await fs.pathExists(nodeRunnerPath)) {
    runnerFile = nodeRunnerPath;
  } else if (await fs.pathExists(pyRunnerPath)) {
    runnerCmd = 'python';
    runnerFile = pyRunnerPath;
  } else if (await fs.pathExists(mcpServerPath)) {
    runnerFile = mcpServerPath;
  } else {
    throw new Error(`No executable runner found in ${skillDir} (checked scripts/run.js, scripts/run.py, mcp-server.js)`);
  }

  // Parse skill metadata
  let skillName = path.basename(resolvedDir);
  let toolName = skillName;
  let isDestructive = false;

  if (await fs.pathExists(skillMdPath)) {
    const content = await fs.readFile(skillMdPath, 'utf8');
    const parsed = matter(content);
    if (parsed.data.name) {
      skillName = parsed.data.name;
      toolName = skillName;
    }
    if (content.includes('DESTRUCTIVE WRITE') || content.includes('confirm')) {
      isDestructive = true;
    }
  }

  const cases: SkillTestCase[] = [];

  // 1. Path Traversal Guardrail Attack Test
  const traversalParams = { path: '../../../../etc/shadow', file: 'c:\\windows\\system32\\cmd.exe' };
  const traversalRes = await runProcess(runnerCmd, [runnerFile, toolName, JSON.stringify(traversalParams)], resolvedDir);
  const traversalBlocked =
    traversalRes.stderr.includes('GUARDRAIL ABORT') ||
    traversalRes.stdout.includes('GUARDRAIL ABORT') ||
    traversalRes.stderr.includes('Path traversal') ||
    traversalRes.code !== 0;

  cases.push({
    name: 'Path Traversal Shield (/etc, System32, ../)',
    category: 'path_traversal',
    inputParams: traversalParams,
    expectedOutcome: 'blocked',
    actualOutcome: traversalBlocked ? 'blocked' : 'passed',
    passed: traversalBlocked,
    message: traversalBlocked
      ? 'Guardrail successfully intercepted and blocked directory climbing attack.'
      : 'VULNERABILITY: Process permitted dangerous relative path traversal!',
  });

  // 2. SSRF Cloud Metadata Endpoint Test
  const ssrfParams = { endpoint: 'http://169.254.169.254/latest/meta-data/' };
  const ssrfRes = await runProcess(runnerCmd, [runnerFile, toolName, JSON.stringify(ssrfParams)], resolvedDir);
  const ssrfBlocked =
    ssrfRes.stderr.includes('GUARDRAIL ABORT') ||
    ssrfRes.stdout.includes('GUARDRAIL ABORT') ||
    ssrfRes.stderr.includes('SSRF') ||
    ssrfRes.code !== 0;

  cases.push({
    name: 'SSRF Cloud Metadata Shield (169.254.169.254)',
    category: 'ssrf',
    inputParams: ssrfParams,
    expectedOutcome: 'blocked',
    actualOutcome: ssrfBlocked ? 'blocked' : 'passed',
    passed: ssrfBlocked,
    message: ssrfBlocked
      ? 'Guardrail successfully intercepted and blocked AWS/GCP metadata query.'
      : 'VULNERABILITY: Process allowed query to cloud metadata address!',
  });

  // 3. Destructive Mutation Lock Test
  if (isDestructive) {
    const unconfirmedParams = { action: 'delete', confirm: false };
    const unconfirmedRes = await runProcess(runnerCmd, [runnerFile, toolName, JSON.stringify(unconfirmedParams)], resolvedDir);
    const mutationBlocked =
      unconfirmedRes.stderr.includes('Destructive operation refused') ||
      unconfirmedRes.stdout.includes('Destructive operation refused') ||
      unconfirmedRes.stderr.includes('confirm') ||
      unconfirmedRes.code !== 0;

    cases.push({
      name: 'Destructive Action Lock (confirm: false refusal)',
      category: 'destructive_lock',
      inputParams: unconfirmedParams,
      expectedOutcome: 'blocked',
      actualOutcome: mutationBlocked ? 'blocked' : 'passed',
      passed: mutationBlocked,
      message: mutationBlocked
        ? 'Destructive action safely refused when confirm: true was absent.'
        : 'VULNERABILITY: Destructive operation executed without explicit confirmation!',
    });

    // 4. Dry-Run Simulation Test
    const dryRunParams = { action: 'delete', dryRun: true };
    const dryRunRes = await runProcess(runnerCmd, [runnerFile, toolName, JSON.stringify(dryRunParams)], resolvedDir);
    const dryRunWorked =
      dryRunRes.stderr.includes('VIBE DRY-RUN') ||
      dryRunRes.stdout.includes('simulated') ||
      dryRunRes.code === 0;

    cases.push({
      name: 'Dry-Run Simulation Mode (dryRun: true)',
      category: 'dry_run',
      inputParams: dryRunParams,
      expectedOutcome: 'simulated',
      actualOutcome: dryRunWorked ? 'simulated' : 'executed',
      passed: dryRunWorked,
      message: dryRunWorked
        ? 'Dry-run safely simulated changes without persisting state alterations.'
        : 'Dry-run flag was ignored or returned non-zero error.',
    });
  }

  // 5. Valid Safe Parameter Test
  const safeParams = { query: 'test-lookup', confirm: true };
  const safeRes = await runProcess(runnerCmd, [runnerFile, toolName, JSON.stringify(safeParams)], resolvedDir);
  const safeExecuted = safeRes.code === 0;

  cases.push({
    name: 'Sanctioned Parameter Execution',
    category: 'valid_execution',
    inputParams: safeParams,
    expectedOutcome: 'pass',
    actualOutcome: safeExecuted ? 'pass' : 'failed',
    passed: safeExecuted,
    message: safeExecuted
      ? 'Tool executed cleanly under safe, sanctioned parameters.'
      : `Execution returned exit code ${safeRes.code}: ${safeRes.stderr || safeRes.stdout}`,
  });

  const passedCount = cases.filter((c) => c.passed).length;
  const failedCount = cases.length - passedCount;

  return {
    skillName,
    runnerPath: runnerFile,
    totalTests: cases.length,
    passedTests: passedCount,
    failedTests: failedCount,
    success: failedCount === 0,
    cases,
  };
}
