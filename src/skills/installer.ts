import path from 'path';
import fs from 'fs-extra';
import os from 'os';

export type SupportedClient =
  | 'claude'
  | 'antigravity'
  | 'cursor'
  | 'opencode'
  | 'hermes'
  | 'goose'
  | 'claudecode'
  | 'openhands';

export interface InstallResult {
  client: SupportedClient;
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

export function getGooseConfigPath(): string {
  if (os.platform() === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Block', 'goose', 'config', 'config.yaml');
  } else {
    return path.join(os.homedir(), '.config', 'goose', 'config.yaml');
  }
}

/**
 * Installs a compiled skill to Claude Desktop MCP, Antigravity, Cursor, OpenCode, and Hermes.
 */
export async function installSkillToClients(
  skillDir: string,
  clients: SupportedClient[] = ['claude', 'antigravity', 'cursor', 'opencode', 'hermes']
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

  // 4. OpenCode Installation
  if (clients.includes('opencode')) {
    if (!fs.existsSync(mcpServerFile)) {
      results.push({
        client: 'opencode',
        status: 'skipped',
        path: '',
        message: 'No mcp-server.js found in skill directory.',
      });
    } else {
      try {
        const cwd = process.cwd();
        const configPath = path.join(cwd, 'opencode.json');
        let config: any = {
          $schema: 'https://opencode.ai/config.json',
          mcp: {},
        };

        if (await fs.pathExists(configPath)) {
          try {
            config = await fs.readJson(configPath);
            if (!config.mcp) config.mcp = {};
          } catch {
            config = { $schema: 'https://opencode.ai/config.json', mcp: {} };
          }
        }

        const isUpdate = !!config.mcp[skillName];
        config.mcp[skillName] = {
          type: 'local',
          command: ['node', mcpServerFile],
          enabled: true,
        };

        await fs.writeJson(configPath, config, { spaces: 2 });
        results.push({
          client: 'opencode',
          status: isUpdate ? 'updated' : 'installed',
          path: configPath,
          message: `Configured '${skillName}' MCP server in workspace opencode.json.`,
        });
      } catch (err: any) {
        results.push({
          client: 'opencode',
          status: 'failed',
          path: '',
          message: err.message,
        });
      }
    }
  }

  // 5. Nous Hermes Agent Installation
  if (clients.includes('hermes')) {
    const hermesToolsFile = path.join(resolvedDir, 'hermes-tools.json');
    if (!fs.existsSync(skillMdFile) && !fs.existsSync(hermesToolsFile)) {
      results.push({
        client: 'hermes',
        status: 'skipped',
        path: '',
        message: 'No SKILL.md or hermes-tools.json found in skill directory.',
      });
    } else {
      try {
        const hermesSkillsDir = path.join(os.homedir(), '.hermes', 'skills', skillName);
        await fs.ensureDir(hermesSkillsDir);

        if (await fs.pathExists(skillMdFile)) {
          await fs.copy(skillMdFile, path.join(hermesSkillsDir, 'SKILL.md'));
        }
        if (await fs.pathExists(hermesToolsFile)) {
          await fs.copy(hermesToolsFile, path.join(hermesSkillsDir, 'hermes-tools.json'));
        }
        const skillYaml = path.join(resolvedDir, 'skill.yaml');
        if (await fs.pathExists(skillYaml)) {
          await fs.copy(skillYaml, path.join(hermesSkillsDir, 'skill.yaml'));
        }
        const hermesPrompt = path.join(resolvedDir, 'hermes-prompt.md');
        if (await fs.pathExists(hermesPrompt)) {
          await fs.copy(hermesPrompt, path.join(hermesSkillsDir, 'hermes-prompt.md'));
        }
        const scriptsDir = path.join(resolvedDir, 'scripts');
        if (await fs.pathExists(scriptsDir)) {
          await fs.copy(scriptsDir, path.join(hermesSkillsDir, 'scripts'));
        }

        results.push({
          client: 'hermes',
          status: 'installed',
          path: hermesSkillsDir,
          message: `Installed Hermes Agent skill package into ~/.hermes/skills/${skillName}`,
        });
      } catch (err: any) {
        results.push({
          client: 'hermes',
          status: 'failed',
          path: '',
          message: err.message,
        });
      }
    }
  }

  // 6. Goose (Block) Installation
  if (clients.includes('goose')) {
    if (!fs.existsSync(mcpServerFile)) {
      results.push({
        client: 'goose',
        status: 'skipped',
        path: '',
        message: 'No mcp-server.js found in skill directory.',
      });
    } else {
      try {
        const gooseConfigPath = getGooseConfigPath();
        await fs.ensureDir(path.dirname(gooseConfigPath));

        const extensionSnippet = `
  ${skillName}:
    enabled: true
    type: stdio
    cmd: node
    args:
      - "${mcpServerFile.replace(/\\/g, '/')}"
    envs:
      VIBE_GUARDRAILS_ENABLED: "true"
`;

        if (await fs.pathExists(gooseConfigPath)) {
          const existing = await fs.readFile(gooseConfigPath, 'utf8');
          if (existing.includes(`${skillName}:`)) {
            results.push({
              client: 'goose',
              status: 'skipped',
              path: gooseConfigPath,
              message: `Extension '${skillName}' already active in Goose config.yaml.`,
            });
          } else if (existing.includes('extensions:')) {
            const updated = existing.replace('extensions:', `extensions:${extensionSnippet}`);
            await fs.writeFile(gooseConfigPath, updated, 'utf8');
            results.push({
              client: 'goose',
              status: 'updated',
              path: gooseConfigPath,
              message: `Appended '${skillName}' MCP extension to Goose config.yaml.`,
            });
          } else {
            const updated = `${existing.trim()}\n\nextensions:${extensionSnippet}`;
            await fs.writeFile(gooseConfigPath, updated, 'utf8');
            results.push({
              client: 'goose',
              status: 'updated',
              path: gooseConfigPath,
              message: `Configured extensions block with '${skillName}' in Goose config.yaml.`,
            });
          }
        } else {
          const newConfig = `# Goose Agent Configuration\nextensions:${extensionSnippet}\n`;
          await fs.writeFile(gooseConfigPath, newConfig, 'utf8');
          results.push({
            client: 'goose',
            status: 'installed',
            path: gooseConfigPath,
            message: `Created Goose config.yaml with '${skillName}' MCP extension.`,
          });
        }
      } catch (err: any) {
        results.push({
          client: 'goose',
          status: 'failed',
          path: '',
          message: err.message,
        });
      }
    }
  }

  // 7. Claude Code (Anthropic CLI) Installation
  if (clients.includes('claudecode')) {
    if (!fs.existsSync(mcpServerFile)) {
      results.push({
        client: 'claudecode',
        status: 'skipped',
        path: '',
        message: 'No mcp-server.js found in skill directory.',
      });
    } else {
      try {
        const cwd = process.cwd();
        const claudeMcpFile = path.join(cwd, '.claude', 'mcp.json');
        await fs.ensureDir(path.dirname(claudeMcpFile));

        let config: any = { mcpServers: {} };
        if (await fs.pathExists(claudeMcpFile)) {
          try {
            config = await fs.readJson(claudeMcpFile);
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

        await fs.writeJson(claudeMcpFile, config, { spaces: 2 });
        results.push({
          client: 'claudecode',
          status: isUpdate ? 'updated' : 'installed',
          path: claudeMcpFile,
          message: `Configured '${skillName}' MCP server in project .claude/mcp.json.`,
        });
      } catch (err: any) {
        results.push({
          client: 'claudecode',
          status: 'failed',
          path: '',
          message: err.message,
        });
      }
    }
  }

  // 8. OpenHands Microagent Installation
  if (clients.includes('openhands')) {
    const microagentSource = path.join(resolvedDir, '.openhands', 'microagents', `${skillName}.md`);
    try {
      const cwd = process.cwd();
      const targetMicroagent = path.join(cwd, '.openhands', 'microagents', `${skillName}.md`);
      await fs.ensureDir(path.dirname(targetMicroagent));

      if (await fs.pathExists(microagentSource)) {
        await fs.copy(microagentSource, targetMicroagent);
      } else {
        const fallbackContent = `---
name: ${skillName}
agent: CodeActAgent
triggers:
  - "${skillName}"
---
# ${skillName} Microagent
Use \`scripts/run.js\` to safely execute this skill suite.
`;
        await fs.writeFile(targetMicroagent, fallbackContent, 'utf8');
      }

      results.push({
        client: 'openhands',
        status: 'installed',
        path: targetMicroagent,
        message: `Installed '${skillName}' microagent in workspace .openhands/microagents/.`,
      });
    } catch (err: any) {
      results.push({
        client: 'openhands',
        status: 'failed',
        path: '',
        message: err.message,
      });
    }
  }

  return results;
}
