import * as p from '@clack/prompts';
import pc from 'picocolors';
import { VERIFIED_FREE_PROVIDERS } from '../core/free-providers.js';

export async function modelsCommand(): Promise<void> {
  p.intro(pc.bgCyan(pc.black(' vibe models ')) + ' ' + pc.bold('Verified 2026 Zero-Card Free Tier Matrix'));

  const rows = Object.values(VERIFIED_FREE_PROVIDERS).map((spec) => {
    const limits = `RPM: ${spec.rpm} | TPM: ${spec.tpm.toLocaleString()} | RPD: ${spec.rpd.toLocaleString()}`;
    const caps = spec.maxInputTokens ? `Input Cap: ${spec.maxInputTokens.toLocaleString()} tokens` : 'Unlimited context';
    return (
      `• ${pc.bold(pc.green(spec.name))} (${pc.cyan(spec.provider)})\n` +
      `  Limits:    ${pc.white(limits)}\n` +
      `  Cap:       ${pc.yellow(caps)}\n` +
      `  Reset:     ${pc.dim(spec.resetRule)} | Cost: ${pc.green('$0')}\n` +
      `  Key / URL: ${pc.dim(spec.signupUrl)}`
    );
  });

  p.note(rows.join('\n\n'), 'Zero-Budget Free Providers (No Credit Card Required)');
  p.outro('Auto-routed by `vibe route` and protected by `vibe pack --budget`.');
}
