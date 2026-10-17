import { describe, it, expect } from 'vitest';
import { generateFeatureSpecMarkdown } from '../src/commands/spec.js';

describe('Feature PRD & Spec Generator', () => {
  it('generates a comprehensive PRD with acceptance criteria and edge cases', () => {
    const md = generateFeatureSpecMarkdown('Stripe Subscription Billing', 'MySaasApp');

    expect(md).toContain('# Feature Specification: Stripe Subscription Billing');
    expect(md).toContain('Problem Statement & Commercial Value');
    expect(md).toContain('Acceptance Criteria');
    expect(md).toContain('UI/UX States & Edge Cases');
    expect(md).toContain('Security & Commercial Controls');
    expect(md).toContain('Implementation Checklist');
  });
});
