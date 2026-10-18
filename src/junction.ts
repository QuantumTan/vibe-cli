import fs from 'fs-extra';
import path from 'path';
import os from 'os';

export interface JunctionResult {
  success: boolean;
  message: string;
  repaired?: boolean;
}

/**
 * Creates an NTFS Directory Junction from linkPath pointing to target.
 * Does not require Administrator privileges or Windows Developer Mode.
 */
export function createJunction(target: string, linkPath: string): JunctionResult {
  const resolvedTarget = path.resolve(target);
  const resolvedLink = path.resolve(linkPath);

  fs.ensureDirSync(resolvedTarget);

  if (fs.existsSync(resolvedLink)) {
    try {
      const stats = fs.lstatSync(resolvedLink);
      if (stats.isSymbolicLink()) {
        const currentTarget = path.resolve(fs.readlinkSync(resolvedLink));
        if (currentTarget.toLowerCase() === resolvedTarget.toLowerCase()) {
          return { success: true, message: 'Junction already verified and up to date.' };
        }
        // Link exists but points to wrong location -> remove and recreate
        fs.unlinkSync(resolvedLink);
      } else {
        return {
          success: false,
          message: `Path ${resolvedLink} already exists and is not a junction. Cannot overwrite directory.`,
        };
      }
    } catch {
      // If broken link, attempt to remove
      try {
        fs.unlinkSync(resolvedLink);
      } catch {
        // ignore
      }
    }
  }

  try {
    const isWin = os.platform() === 'win32';
    fs.symlinkSync(resolvedTarget, resolvedLink, isWin ? 'junction' : 'dir');
    return { success: true, message: `Created junction: ${resolvedLink} -> ${resolvedTarget}` };
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };
    // Graceful cross-platform fallback on EPERM/EXDEV/EINVAL (WSL2 / FAT32 / Codespaces)
    if (error.code === 'EPERM' || error.code === 'EXDEV' || error.code === 'EINVAL' || error.code === 'EACCES') {
      try {
        fs.ensureDirSync(resolvedLink);
        if (fs.existsSync(resolvedTarget)) {
          fs.copySync(resolvedTarget, resolvedLink, { overwrite: false });
        }
        return {
          success: true,
          message: `Created fallback directory via .vibe/memory/ sync: ${resolvedLink}`,
        };
      } catch (fallbackErr: unknown) {
        const fbMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        return { success: false, message: `Failed fallback sync: ${fbMsg}` };
      }
    }

    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Failed to create junction from ${resolvedLink} to ${resolvedTarget}: ${errMsg}`,
    };
  }
}

/**
 * Checks whether an existing junction is valid and points to the expected target.
 */
export function verifyJunction(linkPath: string, expectedTarget: string): boolean {
  try {
    if (!fs.existsSync(linkPath)) return false;
    const stats = fs.lstatSync(linkPath);
    if (!stats.isSymbolicLink()) return false;
    const actual = path.resolve(fs.readlinkSync(linkPath));
    const expected = path.resolve(expectedTarget);
    return actual.toLowerCase() === expected.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Idempotently appends entries into <projectPath>/.git/info/exclude
 */
export function updateGitExclude(projectPath: string, entries: string[]): void {
  const gitDir = path.join(projectPath, '.git');
  if (!fs.existsSync(gitDir) || !fs.statSync(gitDir).isDirectory()) {
    return;
  }

  const infoDir = path.join(gitDir, 'info');
  const excludePath = path.join(infoDir, 'exclude');
  fs.ensureDirSync(infoDir);

  let existing = '';
  if (fs.existsSync(excludePath)) {
    existing = fs.readFileSync(excludePath, 'utf-8');
  }

  const lines = existing.split(/\r?\n/).map((l) => l.trim());
  const toAppend: string[] = [];

  for (const entry of entries) {
    if (!lines.includes(entry)) {
      toAppend.push(entry);
    }
  }

  if (toAppend.length > 0) {
    const newContent =
      (existing ? existing.trimEnd() + '\n' : '') +
      '# vibe-cli automated excludes\n' +
      toAppend.join('\n') +
      '\n';
    fs.writeFileSync(excludePath, newContent, 'utf-8');
  }
}

/**
 * Checks for .env.example without .env and initializes .env safely.
 */
export function checkEnvHealth(projectPath: string): { envCreated: boolean; warning?: string } {
  const envPath = path.join(projectPath, '.env');
  const envExamplePath = path.join(projectPath, '.env.example');

  if (fs.existsSync(envExamplePath) && !fs.existsSync(envPath)) {
    try {
      fs.copyFileSync(envExamplePath, envPath);
      return {
        envCreated: true,
        warning: 'Created .env from .env.example. Remember to set secret keys!',
      };
    } catch {
      return { envCreated: false, warning: 'Found .env.example but no .env is configured.' };
    }
  }

  return { envCreated: false };
}
