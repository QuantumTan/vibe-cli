import { describe, it, expect, vi } from 'vitest';
import { GUIDE_TOPICS, guideCommand } from '../src/commands/guide.js';

describe('Workflow Guides & Documentation (vibe guide)', () => {
  it('defines all required workflow topics with content', () => {
    expect(GUIDE_TOPICS['quickstart']).toBeDefined();
    expect(GUIDE_TOPICS['daily']).toBeDefined();
    expect(GUIDE_TOPICS['architecture']).toBeDefined();
    expect(GUIDE_TOPICS['topology']).toBeDefined();
    expect(GUIDE_TOPICS['launch']).toBeDefined();
    expect(GUIDE_TOPICS['skills']).toBeDefined();
  });

  it('contains actionable commands and instructions in each topic', () => {
    expect(GUIDE_TOPICS['quickstart'].content).toContain('vibe link');
    expect(GUIDE_TOPICS['daily'].content).toContain('vibe dev');
    expect(GUIDE_TOPICS['daily'].content).toContain('vibe triage');
    expect(GUIDE_TOPICS['architecture'].content).toContain('vibe clarify');
    expect(GUIDE_TOPICS['topology'].content).toContain('vibe map');
    expect(GUIDE_TOPICS['launch'].content).toContain('vibe ship');
    expect(GUIDE_TOPICS['skills'].content).toContain('vibe skill compile');
  });

  it('prints topic content directly when topic argument is provided', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await guideCommand('daily');
    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Daily Development Workflow');
    consoleSpy.mockRestore();
  });

  it('prints all topics when all argument is provided', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await guideCommand('all');
    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('First-Time Setup');
    expect(output).toContain('Daily Development Workflow');
    expect(output).toContain('Commercial Launch');
    consoleSpy.mockRestore();
  });
});
