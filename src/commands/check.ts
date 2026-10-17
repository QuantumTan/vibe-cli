import { spawn } from 'child_process';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { loadConfig, findProjectByPath } from '../config.js';
import { inspectProject } from '../inspector.js';

export async function checkCommand(): Promise<void> {
  const cwd = process.cwd();
  const config = loadConfig();
  const registered = findProjectByPath(config, cwd);

  let verifyCmd = registered?.verifyCmd;

  if (!verifyCmd) {
    const meta = await inspectProject(cwd);
    verifyCmd = meta.verifyCmd;
  }

  if (!verifyCmd) {
    p.log.error('No verification command configured or detected for this project.');
    return;
  }

  p.intro(pc.bgMagenta(pc.black(' vibe check ')) + ' ' + pc.bold(`Running verification: ${pc.cyan(verifyCmd)}`));

  const isWin = process.platform === 'win32';
  const child = spawn(verifyCmd, {
    cwd,
    shell: isWin ? 'powershell.exe' : '/bin/sh',
    stdio: 'inherit',
  });

  child.on('error', (err) => {
    p.log.error(`Failed to execute verification command: ${err.message}`);
  });

  child.on('exit', (code) => {
    if (code === 0) {
      p.outro(pc.green('✓ Verification passed! Clean build and checks.'));
    } else {
      p.outro(pc.red(`✗ Verification failed with exit code ${code}.`));
      process.exitCode = code || 1;
    }
  });
}
