import * as p from '@clack/prompts';
import pc from 'picocolors';
import {
  discoverAllTools,
  matchIntentToTools,
  executeRoutedTool,
  startOmniRouteMcpServer,
} from '../skills/omniroute.js';
import { skillCreateCommand } from './skill.js';

import { quotaCommand } from './quota.js';
import { selectOptimalProvider } from '../core/quota-ledger.js';
import { estimateTokens } from '../utils/token-estimator.js';

export interface RouteOptions {
  server?: boolean;
  dryRun?: boolean;
  status?: boolean;
}

/**
 * vibe route [intent]
 */
export async function routeCommand(
  intentInput?: string,
  options: RouteOptions = {}
): Promise<void> {
  if (options.status) {
    await quotaCommand();
    return;
  }

  // If server mode requested, launch MCP multiplexer
  if (options.server) {
    await startOmniRouteMcpServer();
    return;
  }

  p.intro(pc.bgCyan(pc.black(' vibe route ')) + ' ' + pc.bold('OmniRoute Universal AI Tool Gateway'));

  let allTools = await discoverAllTools();

  let intent = intentInput;
  if (!intent) {
    if (allTools.length === 0) {
      p.log.warn('No skills discovered in .vault/Skills/ or ./skills/.');
      p.log.info('OmniRoute dispatches tasks to custom AI skills installed in your workspace.');
      const shouldCreate = await p.confirm({
        message: 'No skills are installed yet. Would you like to synthesize one from natural language now?',
        initialValue: true,
      });

      if (!p.isCancel(shouldCreate) && shouldCreate) {
        await skillCreateCommand();
        const fresh = await discoverAllTools();
        if (fresh.length === 0) {
          p.outro('OmniRoute idle.');
          return;
        }
        allTools = fresh;
        const input = await p.text({
          message: 'Skill created! Now enter task / intent to route across your skills:',
          placeholder: 'Clean old database records and purge cache',
          validate: (val) => (!val?.trim() ? 'Intent is required' : undefined),
        });
        if (p.isCancel(input)) return;
        intent = input.trim();
      } else {
        p.outro('OmniRoute idle. Create a skill using `vibe skill create` or `vibe skill compile`.');
        return;
      }
    } else {
      const input = await p.text({
        message: 'Enter task / intent to route across your AI skills:',
        placeholder: 'Clean old database records and purge cache',
        validate: (val) => (!val?.trim() ? 'Intent is required' : undefined),
      });

      if (p.isCancel(input)) return;
      intent = input.trim();
    }
  }

  const s = p.spinner();
  s.start('Discovering registered tools and computing semantic match...');

  if (allTools.length === 0) {
    s.stop(pc.yellow('No AI tools found.'));
    p.log.warn('No skills discovered in .vault/Skills/ or ./skills/.');
    p.log.info('OmniRoute dispatches tasks to custom AI skills installed in your workspace.');
    const shouldCreate = await p.confirm({
      message: `Would you like to synthesize "${intent}" as a new AI skill now?`,
      initialValue: true,
    });

    if (!p.isCancel(shouldCreate) && shouldCreate) {
      await skillCreateCommand(intent);
      allTools = await discoverAllTools();
      if (allTools.length === 0) {
        p.outro('OmniRoute idle.');
        return;
      }
      p.log.step(pc.green('Skill ready! Proceeding with tool dispatch...'));
    } else {
      p.outro('OmniRoute idle. Create a skill using `vibe skill create` or `vibe skill compile`.');
      return;
    }
  }

  const matches = matchIntentToTools(intent, allTools);

  if (matches.length === 0) {
    s.stop(pc.yellow('No matching tools found.'));
    p.log.info(`Available tools: ${allTools.map((t) => pc.bold(t.toolName)).join(', ')}`);
    p.outro('Refine your query or compile a new skill for this task.');
    return;
  }

  s.stop(`Found ${pc.bold(pc.green(String(matches.length)))} matching tool candidate(s)!`);

  // Pick top match or prompt if multiple
  let chosenMatch = matches[0];

  if (matches.length > 1) {
    const pick = await p.select({
      message: 'Select the tool you want OmniRoute to dispatch to:',
      options: matches.map((m) => ({
        label: `${m.tool.toolName} (${m.tool.skillName}): ${m.confidence.toUpperCase()} confidence`,
        value: m,
        hint: m.tool.description,
      })),
    });

    if (p.isCancel(pick)) return;
    chosenMatch = pick as any;
  }

  const selectedTool = chosenMatch.tool;
  const isDestructive = selectedTool.riskLevel === 'destructive_write';

  const riskBadge = isDestructive
    ? pc.bgRed(pc.white(' 🔴 DESTRUCTIVE WRITE '))
    : selectedTool.riskLevel === 'idempotent_write'
    ? pc.bgYellow(pc.black(' 🟡 WRITE '))
    : pc.bgGreen(pc.black(' 🟢 READ ONLY '));

  p.note(
    `Tool:        ${pc.bold(pc.cyan(selectedTool.toolName))} (${pc.dim(selectedTool.skillName)})\n` +
      `Risk Level:  ${riskBadge}\n` +
      `Description: ${pc.white(selectedTool.description)}\n` +
      `Parameters:  ${JSON.stringify(chosenMatch.extractedParams)}`,
    'OmniRoute Dispatch Plan'
  );

  const execParams: Record<string, any> = { ...chosenMatch.extractedParams };

  if (options.dryRun) {
    execParams['dryRun'] = true;
  } else if (isDestructive) {
    const confirm = await p.confirm({
      message: pc.yellow(`Caution: This tool performs destructive mutations. Execute action?`),
      initialValue: false,
    });

    if (p.isCancel(confirm) || !confirm) {
      p.cancel('Execution aborted by user safety confirmation.');
      return;
    }
    execParams['confirm'] = true;
  }

  s.start(`Executing ${selectedTool.toolName} via guarded runner...`);
  const res = await executeRoutedTool(selectedTool, execParams);

  if (res.success) {
    s.stop(pc.green(`✔ Execution succeeded!`));
    p.note(res.output || 'Action executed successfully.', 'Execution Output');
    p.outro(pc.green('OmniRoute dispatch complete.'));
  } else {
    s.stop(pc.red(`✖ Execution failed.`));
    p.log.error(res.error || res.output);
    p.outro(pc.red('OmniRoute execution aborted.'));
  }
}
