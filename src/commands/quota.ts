import * as p from '@clack/prompts';
import pc from 'picocolors';
import { getQuotaReport } from '../core/quota-ledger.js';

export async function quotaCommand(): Promise<void> {
  p.intro(pc.bgCyan(pc.black(' vibe quota ')) + ' ' + pc.bold('Zero-Dollar Free Tier Quota Ledger'));

  const report = await getQuotaReport();
  console.log('\n' + report + '\n');

  p.note(
    `• Automatic failover active when rate limits or daily quotas are reached.\n` +
      `• Cloud tiers automatically reset at Midnight Pacific / UTC.\n` +
      `• Local Ollama / LM Studio models provide unlimited offline fallback.`,
    'Zero-Budget Free Quota Status'
  );

  p.outro('Run `vibe route "<task>"` to dispatch using the optimal available model.');
}
