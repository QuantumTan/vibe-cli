import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import readline from 'node:readline';
import { spawn } from 'child_process';
import matter from 'gray-matter';
import { SkillTool, ToolRiskLevel } from './types.js';

export interface DiscoveredTool {
  skillName: string;
  toolName: string;
  description: string;
  riskLevel: ToolRiskLevel;
  runnerPath: string;
  runnerType: 'node' | 'python';
  parameters: Record<string, any>;
  required: string[];
}

export interface RouteMatch {
  tool: DiscoveredTool;
  score: number;
  extractedParams: Record<string, any>;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Discovers all installed skills and tools across project vaults and workspace directories.
 */
export async function discoverAllTools(baseDir = process.cwd()): Promise<DiscoveredTool[]> {
  const searchDirs = [
    path.join(baseDir, '.vault', 'Skills'),
    path.join(baseDir, 'skills'),
    path.join(baseDir, '.opencode', 'skills'),
    path.join(baseDir, '.claude', 'skills'),
    path.join(os.homedir(), '.hermes', 'skills'),
  ];

  const tools: DiscoveredTool[] = [];

  for (const dir of searchDirs) {
    if (await fs.pathExists(dir)) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillDir = path.join(dir, entry.name);
        const skillMd = path.join(skillDir, 'SKILL.md');
        const nodeRunner = path.join(skillDir, 'scripts', 'run.js');
        const pyRunner = path.join(skillDir, 'scripts', 'run.py');
        const mcpServer = path.join(skillDir, 'mcp-server.js');

        let runnerPath = '';
        let runnerType: 'node' | 'python' = 'node';

        if (await fs.pathExists(nodeRunner)) {
          runnerPath = nodeRunner;
          runnerType = 'node';
        } else if (await fs.pathExists(pyRunner)) {
          runnerPath = pyRunner;
          runnerType = 'python';
        } else if (await fs.pathExists(mcpServer)) {
          runnerPath = mcpServer;
          runnerType = 'node';
        }

        if (await fs.pathExists(skillMd)) {
          try {
            const rawContent = await fs.readFile(skillMd, 'utf8');
            const parsed = matter(rawContent);
            const skillName = parsed.data.name || entry.name;

            // Extract tools from markdown headings or frontmatter
            const toolHeadingRegex = /###\s+`([^`]+)`\s*(?:\(([^)]+)\))?\s*\n+([\s\S]*?)(?=(?:###\s+`|$))/g;
            let match: RegExpExecArray | null;
            let foundTools = false;

            while ((match = toolHeadingRegex.exec(parsed.content)) !== null) {
              foundTools = true;
              const toolName = match[1].trim();
              const badge = (match[2] || '').toLowerCase();
              const body = match[3].trim();

              let risk: ToolRiskLevel = 'read_only';
              if (badge.includes('destructive')) risk = 'destructive_write';
              else if (badge.includes('privileged')) risk = 'privileged';
              else if (badge.includes('write')) risk = 'idempotent_write';

              tools.push({
                skillName,
                toolName,
                description: body.split('\n')[0] || `${toolName} tool`,
                riskLevel: risk,
                runnerPath,
                runnerType,
                parameters: {},
                required: [],
              });
            }

            if (!foundTools && runnerPath) {
              tools.push({
                skillName,
                toolName: skillName,
                description: parsed.data.description || `${skillName} skill`,
                riskLevel: 'read_only',
                runnerPath,
                runnerType,
                parameters: {},
                required: [],
              });
            }
          } catch {
            // Ignore malformed SKILL.md
          }
        }
      }
    }
  }

  return tools;
}

/**
 * Matches a natural language intent against registered tools and computes relevance score.
 */
export function matchIntentToTools(intent: string, tools: DiscoveredTool[]): RouteMatch[] {
  const normalized = intent.toLowerCase().replace(/[^a-z0-9_\s]/g, ' ');
  const tokens = normalized.split(/\s+/).filter((t) => t.length > 2);

  const matches: RouteMatch[] = [];

  for (const tool of tools) {
    let score = 0;
    const toolText = `${tool.skillName} ${tool.toolName} ${tool.description}`.toLowerCase().replace(/[_.-]/g, ' ');

    for (const token of tokens) {
      if (tool.toolName.toLowerCase() === token) score += 40;
      else if (tool.toolName.toLowerCase().includes(token)) score += 20;

      if (tool.skillName.toLowerCase() === token) score += 30;
      else if (tool.skillName.toLowerCase().includes(token)) score += 15;

      if (tool.description.toLowerCase().includes(token)) score += 10;
    }

    if (score > 0) {
      const confidence: RouteMatch['confidence'] = score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';

      // Extract parameter candidates (e.g. key=val or URLs/numbers)
      const extractedParams: Record<string, any> = {};
      const urlMatch = intent.match(/https?:\/\/[^\s]+/i);
      if (urlMatch) extractedParams['url'] = urlMatch[0];

      const numMatch = intent.match(/\b\d+\b/);
      if (numMatch) extractedParams['limit'] = parseInt(numMatch[0], 10);

      matches.push({
        tool,
        score,
        extractedParams,
        confidence,
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

/**
 * Executes a discovered tool via its guarded standalone runner.
 */
export async function executeRoutedTool(
  tool: DiscoveredTool,
  params: Record<string, any>
): Promise<{ success: boolean; output: string; error?: string }> {
  if (!tool.runnerPath || !(await fs.pathExists(tool.runnerPath))) {
    return { success: false, output: '', error: `Runner script not found for tool ${tool.toolName}` };
  }

  return new Promise((resolve) => {
    const cmd = tool.runnerType === 'python' ? 'python' : 'node';
    const child = spawn(cmd, [tool.runnerPath, tool.toolName, JSON.stringify(params)], {
      cwd: path.dirname(path.dirname(tool.runnerPath)),
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output: stdout.trim() || stderr.trim() });
      } else {
        resolve({ success: false, output: stdout.trim(), error: stderr.trim() || `Exited with code ${code}` });
      }
    });

    child.on('error', (err) => {
      resolve({ success: false, output: '', error: err.message });
    });
  });
}

/**
 * Starts the OmniRoute MCP Multiplexer Gateway over stdio.
 */
export async function startOmniRouteMcpServer(): Promise<void> {
  const tools = await discoverAllTools();

  const mcpToolsList = tools.map((t) => ({
    name: `${t.skillName}_${t.toolName}`,
    description: `[${t.riskLevel.toUpperCase()}] ${t.description} (via ${t.skillName})`,
    inputSchema: {
      type: 'object',
      properties: {
        payload: { type: 'object', description: 'Tool arguments' },
        confirm: { type: 'boolean', description: 'Explicit safety confirmation for destructive operations' },
        dryRun: { type: 'boolean', description: 'Simulate without mutating state' },
      },
    },
  }));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  function send(resp: any) {
    process.stdout.write(JSON.stringify(resp) + '\n');
  }

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let req: any;
    try {
      req = JSON.parse(trimmed);
    } catch {
      send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      return;
    }

    const { id, method, params } = req;

    try {
      switch (method) {
        case 'initialize':
          send({
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: { tools: {} },
              serverInfo: { name: 'vibe-omniroute', version: '1.0.0' },
            },
          });
          break;

        case 'notifications/initialized':
          break;

        case 'tools/list':
          send({ jsonrpc: '2.0', id, result: { tools: mcpToolsList } });
          break;

        case 'tools/call': {
          const calledName = params?.name;
          const matchedTool = tools.find((t) => `${t.skillName}_${t.toolName}` === calledName || t.toolName === calledName);

          if (!matchedTool) {
            send({ jsonrpc: '2.0', id, error: { code: -32602, message: `Tool ${calledName} not found in OmniRoute` } });
            return;
          }

          const callParams = { ...(params?.arguments?.payload || {}), ...params?.arguments };
          const execRes = await executeRoutedTool(matchedTool, callParams);

          send({
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: execRes.success ? execRes.output : `[OMNIROUTE ERROR] ${execRes.error}`,
                },
              ],
            },
          });
          break;
        }

        default:
          if (id !== undefined) {
            send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method '${method}' not found` } });
          }
      }
    } catch (err: any) {
      if (id !== undefined) {
        send({ jsonrpc: '2.0', id, error: { code: -32603, message: err.message } });
      }
    }
  });

  process.stderr.write(`[OMNIROUTE] Universal AI Gateway active with ${tools.length} discovered tools\n`);
}
