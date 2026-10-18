import path from 'path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import {
  createCheckpoint,
  listCheckpoints,
  restoreCheckpoint,
  checkpointCommand,
  rollbackCommand,
} from './checkpoint.js';
import { executeRewind, rewindCommand } from './rewind.js';
import { snapCommand } from './snap.js';

export interface StateSaveOptions {
  lesson?: string;
}

export interface StateRestoreOptions {
  rewind?: boolean;
  hard?: boolean;
}

/**
 * vibe state save [label]
 */
export async function stateSaveCommand(labelInput?: string, options: StateSaveOptions = {}): Promise<void> {
  const cwd = process.cwd();

  if (options.lesson) {
    await snapCommand(options.lesson);
    return;
  }

  await checkpointCommand(labelInput);
}

/**
 * vibe state restore [id]
 */
export async function stateRestoreCommand(idInput?: string, options: StateRestoreOptions = {}): Promise<void> {
  const cwd = process.cwd();

  if (options.rewind || (!idInput && options.hard)) {
    await rewindCommand({ hard: options.hard });
    return;
  }

  await rollbackCommand(idInput);
}

/**
 * vibe state [action]
 */
export async function stateCommand(
  action?: 'save' | 'restore' | 'list',
  arg?: string,
  options: StateSaveOptions & StateRestoreOptions = {}
): Promise<void> {
  if (!action) {
    p.intro(pc.bgCyan(pc.black(' vibe state ')) + ' ' + pc.bold('Unified State & Memory Controller'));

    const choice = await p.select({
      message: 'Select state action:',
      options: [
        { value: 'save', label: 'Save workspace state / checkpoint', hint: 'vibe state save' },
        { value: 'restore', label: 'Restore previous checkpoint', hint: 'vibe state restore' },
        { value: 'rewind', label: '1-click panic rewind (discard uncommitted AI edits)', hint: 'vibe rewind' },
        { value: 'lesson', label: 'Log lesson note into Memory Bank', hint: 'vibe state save --lesson' },
        { value: 'list', label: 'List all stored checkpoints', hint: 'vibe state list' },
      ],
    });

    if (p.isCancel(choice)) {
      p.cancel('State operation canceled.');
      return;
    }

    if (choice === 'save') return stateSaveCommand();
    if (choice === 'restore') return stateRestoreCommand();
    if (choice === 'rewind') return rewindCommand();
    if (choice === 'lesson') return snapCommand();
    if (choice === 'list') return checkpointCommand(undefined, { list: true });
    return;
  }

  if (action === 'save') {
    await stateSaveCommand(arg, options);
  } else if (action === 'restore') {
    await stateRestoreCommand(arg, options);
  } else if (action === 'list') {
    await checkpointCommand(undefined, { list: true });
  }
}
