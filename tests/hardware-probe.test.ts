import { describe, it, expect } from 'vitest';
import { getHardwareProfile, probeVram } from '../src/utils/hardware-probe.js';

describe('Hardware VRAM Probe & Local Model Recommendation Matrix', () => {
  it('reads system RAM in gigabytes cleanly', () => {
    const profile = getHardwareProfile();
    expect(profile.totalRamGb).toBeGreaterThan(0);
    expect(profile.freeRamGb).toBeGreaterThanOrEqual(0);
    expect(profile.tier).toMatch(/low|mid|high/);
    expect(profile.recommendedLocalModel).toBeDefined();
  });

  it('probes nvidia-smi output correctly with custom execFn', () => {
    const mockExec = (cmd: string) => {
      if (cmd.includes('nvidia-smi')) {
        return 'NVIDIA GeForce RTX 3050 Laptop GPU, 4096\n';
      }
      return null;
    };

    const probed = probeVram(mockExec);
    expect(probed.vramGb).toBe(4);
    expect(probed.gpuName).toBe('NVIDIA GeForce RTX 3050 Laptop GPU');
  });

  it('recommends 4096 context cap and 3B/7B model for 4GB VRAM laptop (RTX 3050)', () => {
    const profile = getHardwareProfile({
      totalRamBytes: 16 * 1024 * 1024 * 1024,
      freeRamBytes: 8 * 1024 * 1024 * 1024,
      vramGb: 4,
      gpuName: 'NVIDIA GeForce RTX 3050 Laptop GPU',
    });

    expect(profile.tier).toBe('mid');
    expect(profile.vramGb).toBe(4);
    expect(profile.recommendedContextCap).toBe(4096);
    expect(profile.recommendedLocalModel).toContain('qwen2.5-coder:3b-instruct-q4_K_M');
    expect(profile.advice).toContain('--num-ctx 4096');
  });

  it('recommends 7B/14B for 8GB+ VRAM rigs', () => {
    const profile = getHardwareProfile({
      totalRamBytes: 32 * 1024 * 1024 * 1024,
      freeRamBytes: 16 * 1024 * 1024 * 1024,
      vramGb: 12,
      gpuName: 'NVIDIA GeForce RTX 4070',
    });

    expect(profile.tier).toBe('high');
    expect(profile.vramGb).toBe(12);
    expect(profile.recommendedContextCap).toBe(8192);
    expect(profile.recommendedLocalModel).toContain('7b or 14b');
  });

  it('recommends cloud free tiers when integrated graphics or <8GB RAM detected', () => {
    const profile = getHardwareProfile({
      totalRamBytes: 6 * 1024 * 1024 * 1024, // 6 GB RAM
      freeRamBytes: 2 * 1024 * 1024 * 1024,
      vramGb: undefined,
      gpuName: 'Integrated Graphics',
    });

    expect(profile.tier).toBe('low');
    expect(profile.recommendedLocalModel).toContain('Cloud-only free tiers');
    expect(profile.advice).toContain('Groq');
  });
});
