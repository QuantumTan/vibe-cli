import path from 'path';
import fs from 'fs-extra';
import os from 'os';

export interface InstallResult {
  client: 'claude' | 'antigravity' | 'cursor';
  status: 'installed' | 'updated' | 'skipped' | 'failed';
  path: string;
  message: string;
}

export function getClaudeDesktopConfigPath(): string {
  if (os.platform() === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
  } else if (os.platform() === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  } else {
    return path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
  }
}

/**
 * Installs a compiled skill to Claude Desktop MCP, Antigravity, and Cursor.
 */
export async function installSkillToClients(
  skillDir: string,
  clients: Array<'claude' | 'antigravity' | 'cursor'> = ['claude', 'antigravity', 'cursor']
): Promise<InstallResult[]> {
  const resolvedDir = path.resolve(skillDir);
  const skillName = path.basename(resolvedDir);
  const results: InstallResult[] = [];

  const mcpServerFile = path.join(resolvedDir, 'mcp-server.js');
  const skillMdFile = path.join(resolvedDir, 'SKILL.md');
  const cursorRulesFile = path.join(resolvedDir, '.cursorrules');

  // 1. Claude Desktop Installation
  if (clients.includes('claude')) {
    if (!fs.existsSync(mcpServerFile)) {
      results.push({
        client: 'claude',
        status: 'skipped',
        path: '',
        message: 'No mcp-server.js found in skill directory.',
      });
    } else {
      try {
        const configPath = getClaudeDesktopConfigPath();
        await fs.ensureDir(path.dirname(configPath));

        let config: any = { mcpServers: {} };
        if (await fs.pathExists(configPath)) {
          try {
            config = await fs.readJson(configPath);
            if (!config.mcpServers) config.mcpServers = {};
          } catch {
            config = { mcpServers: {} };
          }
        }

        const isUpdate = !!config.mcpServers[skillName];
        config.mcpServers[skillName] = {
          command: 'node',
          args: [mcpServerFile],
        };

        await fs.writeJson(configPath, config, { spaces: 2 });
        results.push({
          client: 'claude',
          status: isUpdate ? 'updated' : 'installed',
          path: configPath,
          message: `Configured stdio MCP server for '${skillName}' in Claude Desktop.`,
        });
      } catch (err: any) {
        results.push({
          client: 'claude',
          status: 'failed',
          path: '',
          message: err.message,
        });
      }
    }
  }

  // 2. Google Antigravity Installation
  if (clients.includes('antigravity')) {
    if (!fs.existsSync(skillMdFile)) {
      results.push({
        client: 'antigravity',
        status: 'skipped',
        path: '',
        message: 'No SKILL.md found in skill directory.',
      });
    } else {
      try {
        // Global Antigravity skills directory
        const antigravitySkillsDir = path.join(os.homedir(), '.gemini', 'antigravity', 'skills', skillName);
        await fs.ensureDir(antigravitySkillsDir);

        // Copy SKILL.md and scripts/
        await fs.copy(skillMdFile, path.join(antigravitySkillsDir, 'SKILL.md'));
        const scriptsDir = path.join(resolvedDir, 'scripts');
        if (await fs.pathExists(scriptsDir)) {
          await fs.copy(scriptsDir, path.join(antigravitySkillsDir, 'scripts'));
        }

        results.push({
          client: 'antigravity',
          status: 'installed',
          path: antigravitySkillsDir,
          message: `Installed Antigravity skill package into ~/.gemini/antigravity/skills/${skillName}`,
        });
      } catch (err: any) {
        results.push({
          client: 'antigravity',
          status: 'failed',
          path: '',
          message: err.message,
        });
      }
    }
  }

  // 3. Cursor & Windsurf Installation
  if (clients.includes('cursor')) {
    if (!fs.existsSync(cursorRulesFile)) {
      results.push({
        client: 'cursor',
        status: 'skipped',
        path: '',
        message: 'No .cursorrules found in skill directory.',
      });
    } else {
      try {
        const cwd = process.cwd();
        const targetCursorRules = path.join(cwd, '.cursorrules');
        const skillRulesContent = await fs.readFile(cursorRulesFile, 'utf8');

        let updatedContent = skillRulesContent;
        if (await fs.pathExists(targetCursorRules)) {
          const existing = await fs.readFile(targetCursorRules, 'utf8');
          if (existing.includes(`VIBE SKILL: ${skillName}`)) {
            results.push({
              client: 'cursor',
              status: 'skipped',
              path: targetCursorRules,
              message: `Rule for '${skillName}' already active in project .cursorrules.`,
            });
          } else {
            updatedContent = `${existing.trim()}\n\n---\n\n${skillRulesContent}`;
            await fs.writeFile(targetCursorRules, updatedContent, 'utf8');
            results.push({
              client: 'cursor',
              status: 'updated',
              path: targetCursorRules,
              message: `Appended '${skillName}' rules to workspace .cursorrules.`,
            });
          }
        } else {
          await fs.writeFile(targetCursorRules, updatedContent, 'utf8');
          results.push({
            client: 'cursor',
            status: 'installed',
            path: targetCursorRules,
            message: `Created workspace .cursorrules with '${skillName}' specification.`,
          });
        }
      } catch (err: any) {
        results.push({
          client: 'cursor',
          status: 'failed',
          path: '',
          message: err.message,
        });
      }
    }
  }

  return results;
}
