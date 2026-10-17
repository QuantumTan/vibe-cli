import path from 'path';
import fs from 'fs-extra';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { loadConfig } from '../config.js';
import { openWindowsFolderPicker } from '../gui-picker.js';
import { linkProjectPipeline } from './link.js';
import { promptOrSelectVault } from './vault.js';

export interface InitOptions {
  browse?: boolean;
  vault?: string;
}

export async function initCommand(projectName?: string, options: InitOptions = {}): Promise<void> {
  const config = loadConfig();
  p.intro(pc.bgGreen(pc.black(' vibe init ')) + ' ' + pc.bold('Scaffold New Project & Auto-Wire'));

  let name = projectName;
  if (!name) {
    const input = await p.text({
      message: 'Enter new project name:',
      placeholder: 'my-cool-app',
      validate: (val) => (!val?.trim() ? 'Project name cannot be empty' : undefined),
    });

    if (p.isCancel(input)) {
      p.cancel('Init canceled.');
      return;
    }
    name = (input as string).trim();
  }

  let parentDir = config.projectsRoot;
  if (options.browse) {
    const chosen = await openWindowsFolderPicker('Select Parent Directory for New Project', config.projectsRoot);
    if (!chosen) {
      p.cancel('Init canceled.');
      return;
    }
    parentDir = chosen;
  }

  const projectDir = path.join(parentDir, name);
  fs.ensureDirSync(projectDir);

  // If empty, create initial README.md
  const readmePath = path.join(projectDir, 'README.md');
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(readmePath, `# ${name}\n\nProject initialized with vibe-cli.\n`, 'utf-8');
  }

  // Vault Selection
  const vaultSelection = await promptOrSelectVault(config, options.vault);
  if (!vaultSelection) {
    p.cancel('Init canceled.');
    return;
  }
  const vault = vaultSelection.vaultName;

  const s = p.spinner();
  s.start(`Scaffolding and wiring ${pc.bold(name)} to ${pc.cyan(vault)}...`);

  const result = await linkProjectPipeline(projectDir, vault);

  if (!result.success) {
    s.stop(pc.red('Failed to wire project.'));
    p.log.error(result.error || 'Unknown error');
    return;
  }

  s.stop(pc.green(`Project created and wired to ${vault}!`));
  p.note(`Directory: ${projectDir}\nObsidian:  02-Projects/${name}`, 'Scaffold Complete');
  p.outro(pc.green('Ready to code!'));
}
