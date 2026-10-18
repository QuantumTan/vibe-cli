import path from 'path';
import fs from 'fs-extra';

export interface LinkResult {
  success: boolean;
  type: 'junction' | 'symlink' | 'copy_sync';
  message: string;
}

/**
 * Creates cross-platform links with graceful fallback to .vibe/memory/ copy-sync.
 */
export function createSafeLink(
  targetPath: string,
  linkPath: string,
  options: { portable?: boolean } = {}
): LinkResult {
  const isWindows = process.platform === 'win32';

  // If explicit portable mode requested, skip symlink/junction and use copy-sync
  if (options.portable) {
    return setupCopySyncFallback(targetPath, linkPath);
  }

  // Ensure parent directory exists
  fs.ensureDirSync(path.dirname(linkPath));

  // If target already exists at linkPath, check if already linked
  if (fs.existsSync(linkPath)) {
    try {
      const stat = fs.lstatSync(linkPath);
      if (stat.isSymbolicLink()) {
        fs.unlinkSync(linkPath);
      } else {
        return setupCopySyncFallback(targetPath, linkPath);
      }
    } catch {
      // Continue to try recreating link
    }
  }

  try {
    if (isWindows) {
      // Windows NTFS Junction (requires no administrator privileges)
      fs.symlinkSync(targetPath, linkPath, 'junction');
      return {
        success: true,
        type: 'junction',
        message: `Created Windows NTFS directory junction: ${linkPath} -> ${targetPath}`,
      };
    } else {
      // POSIX directory symlink (macOS / Linux)
      fs.symlinkSync(targetPath, linkPath, 'dir');
      return {
        success: true,
        type: 'symlink',
        message: `Created POSIX directory symlink: ${linkPath} -> ${targetPath}`,
      };
    }
  } catch (err: unknown) {
    const error = err as { code?: string; message?: string };
    // Catch EPERM, EXDEV, EINVAL, EEXIST on WSL2 cross-mounts, FAT32/exFAT, Codespaces
    if (
      error.code === 'EPERM' ||
      error.code === 'EXDEV' ||
      error.code === 'EINVAL' ||
      error.code === 'EEXIST' ||
      error.code === 'EACCES'
    ) {
      return setupCopySyncFallback(targetPath, linkPath);
    }

    return {
      success: false,
      type: isWindows ? 'junction' : 'symlink',
      message: `Failed to create link: ${error.message || String(err)}`,
    };
  }
}

/**
 * Sets up a fallback local .vibe/memory/ copy-sync directory.
 */
function setupCopySyncFallback(targetPath: string, linkPath: string): LinkResult {
  try {
    fs.ensureDirSync(linkPath);
    if (fs.existsSync(targetPath)) {
      fs.copySync(targetPath, linkPath, { overwrite: false, errorOnExist: false });
    }
    return {
      success: true,
      type: 'copy_sync',
      message: `Cross-filesystem fallback active: synchronized to local ${linkPath}`,
    };
  } catch (err: unknown) {
    const error = err as Error;
    return {
      success: false,
      type: 'copy_sync',
      message: `Failed to initialize memory directory: ${error.message}`,
    };
  }
}

/**
 * Syncs modified markdown notes between directories for portable mode.
 */
export function syncPortableMemory(sourceDir: string, destDir: string): number {
  if (!fs.existsSync(sourceDir)) return 0;
  fs.ensureDirSync(destDir);

  let syncedCount = 0;
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(sourceDir, entry.name);
    const dstPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      syncedCount += syncPortableMemory(srcPath, dstPath);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      if (!fs.existsSync(dstPath)) {
        fs.copyFileSync(srcPath, dstPath);
        syncedCount++;
      } else {
        const srcMtime = fs.statSync(srcPath).mtimeMs;
        const dstMtime = fs.statSync(dstPath).mtimeMs;
        if (srcMtime > dstMtime) {
          fs.copyFileSync(srcPath, dstPath);
          syncedCount++;
        }
      }
    }
  }

  return syncedCount;
}

/**
 * Formats a link as either an Obsidian wikilink or standard Markdown link.
 */
export function formatLink(title: string, relPath: string, noObsidian = false): string {
  const normalized = relPath.replace(/\\/g, '/');
  if (noObsidian) {
    return `[${title}](./${normalized})`;
  }
  const wikiTarget = normalized.replace(/\.md$/, '');
  return `[[${wikiTarget}|${title}]]`;
}
