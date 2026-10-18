import os from 'node:os';
import { execSync } from 'node:child_process';

export interface HardwareProfile {
  totalRamGb: number;
  freeRamGb: number;
  vramGb?: number;
  gpuName?: string;
  recommendedLocalModel?: string;
  recommendedContextCap?: number;
  tier: 'low' | 'mid' | 'high';
  advice: string;
}

/**
 * Runs a command with a strict timeout in ms. Returns stdout or null.
 */
function runWithTimeout(cmd: string, timeoutMs = 1500): string | null {
  try {
    return execSync(cmd, {
      timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Probes GPU VRAM safely across Windows, Linux, and macOS.
 */
export function probeVram(execFn?: (cmd: string) => string | null): { vramGb?: number; gpuName?: string } {
  const run = execFn || ((cmd: string) => runWithTimeout(cmd, 1500));

  // 1. Try nvidia-smi across Windows / Linux
  const nvidiaOut = run('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits');
  if (nvidiaOut) {
    const firstLine = nvidiaOut.split('\n')[0].trim();
    const parts = firstLine.split(',');
    if (parts.length >= 2) {
      const name = parts[0].trim();
      const mb = parseFloat(parts[1].trim());
      if (!isNaN(mb) && mb > 0) {
        return {
          vramGb: Math.round((mb / 1024) * 10) / 10,
          gpuName: name,
        };
      }
    }
  }

  // 2. Windows fallback: PowerShell CIM query
  if (process.platform === 'win32') {
    const psCmd = 'powershell.exe -NoProfile -Command "(Get-CimInstance Win32_VideoController | Select-Object -First 1 Name, AdapterRAM | ConvertTo-Json)"';
    const psOut = run(psCmd);
    if (psOut) {
      try {
        const parsed = JSON.parse(psOut);
        const name = parsed.Name || 'Integrated Graphics';
        const bytes = parseInt(parsed.AdapterRAM, 10);
        if (!isNaN(bytes) && bytes > 0) {
          const gb = Math.round((bytes / (1024 * 1024 * 1024)) * 10) / 10;
          return { vramGb: gb, gpuName: name };
        }
      } catch {
        // Fallback
      }
    }
  }

  // 3. macOS: Apple Silicon unified memory
  if (process.platform === 'darwin') {
    const memOut = run('sysctl -n hw.memsize');
    if (memOut) {
      const bytes = parseInt(memOut, 10);
      if (!isNaN(bytes)) {
        // Apple unified memory: allocation for GPU is typically ~70% of unified RAM
        const unifiedGb = Math.round((bytes / (1024 * 1024 * 1024)) * 10) / 10;
        return {
          vramGb: Math.round(unifiedGb * 0.7 * 10) / 10,
          gpuName: 'Apple Silicon Unified Memory',
        };
      }
    }
  }

  return {};
}

/**
 * Evaluates hardware and yields exact local Ollama model recommendations.
 */
export function getHardwareProfile(
  overrides?: {
    totalRamBytes?: number;
    freeRamBytes?: number;
    vramGb?: number;
    gpuName?: string;
  }
): HardwareProfile {
  const totalRamBytes = overrides?.totalRamBytes !== undefined ? overrides.totalRamBytes : os.totalmem();
  const freeRamBytes = overrides?.freeRamBytes !== undefined ? overrides.freeRamBytes : os.freemem();

  const totalRamGb = Math.round((totalRamBytes / (1024 * 1024 * 1024)) * 10) / 10;
  const freeRamGb = Math.round((freeRamBytes / (1024 * 1024 * 1024)) * 10) / 10;

  const probed = overrides && (overrides.vramGb !== undefined || overrides.gpuName !== undefined)
    ? { vramGb: overrides.vramGb, gpuName: overrides.gpuName }
    : probeVram();

  const { vramGb, gpuName } = probed;

  // Recommendation matrix
  if (vramGb && vramGb >= 8) {
    return {
      totalRamGb,
      freeRamGb,
      vramGb,
      gpuName,
      tier: 'high',
      recommendedLocalModel: 'qwen2.5-coder:7b or 14b',
      recommendedContextCap: 8192,
      advice: 'Sufficient dedicated VRAM to run 7B or 14B models comfortably at full context.',
    };
  }

  if ((vramGb && vramGb >= 3.5 && vramGb <= 6) || (totalRamGb >= 8 && totalRamGb <= 16 && vramGb && vramGb >= 2)) {
    return {
      totalRamGb,
      freeRamGb,
      vramGb,
      gpuName: gpuName || 'NVIDIA Mobile GPU (e.g. RTX 3050)',
      tier: 'mid',
      recommendedLocalModel: 'qwen2.5-coder:3b-instruct-q4_K_M (or 7b-instruct-q4_K_M)',
      recommendedContextCap: 4096,
      advice: 'Set --num-ctx 4096 to prevent VRAM spillover into system RAM and avoid laptop freezing.',
    };
  }

  // Low tier / Integrated GPU / < 8GB RAM
  return {
    totalRamGb,
    freeRamGb,
    vramGb,
    gpuName: gpuName || 'Integrated Graphics',
    tier: 'low',
    recommendedLocalModel: 'Cloud-only free tiers + optional qwen2.5-coder:1.5b',
    recommendedContextCap: 2048,
    advice: 'Local models larger than 1.5B will cause system paging. Rely on free cloud tiers (Groq, Gemini Free).',
  };
}
