import path from 'path';
import { spawn } from 'child_process';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { loadConfig, findProjectByPath } from '../config.js';
import { inspectProject } from '../inspector.js';

export async function devCommand(): Promise<void> {
  const cwd = process.cwd();
  const config = loadConfig();
  const registered = findProjectByPath(config, cwd);

  let commandToRun = registered?.devCmd;

  if (!commandToRun) {
    const meta = await inspectProject(cwd);
    commandToRun = meta.devCmd;
  }

  if (!commandToRun) {
    p.log.error('No development command detected for this project.');
    p.log.info('You can run your dev server manually or add a "dev" script to package.json.');
    return;
  }

  p.intro(pc.bgGreen(pc.black(' vibe dev ')) + ' ' + pc.bold(`Launching dev server: ${pc.cyan(commandToRun)}`));

  const isWin = process.platform === 'win32';
  const child = spawn(commandToRun, {
    cwd,
    shell: isWin ? 'powershell.exe' : '/bin/sh',
    stdio: 'inherit',
  });

  child.on('error', (err) => {
    p.log.error(`Failed to launch dev command: ${err.message}`);
  });

  child.on('exit', (code) => {
    if (code === 0) {
      p.log.success('Dev server stopped cleanly.');
    } else {
      p.log.warn(`Dev server exited with code ${code}.`);
    }
  });
}
