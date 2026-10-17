import { SkillIR, GeneratedFile } from '../types.js';
import { generateNodeGuardrails } from '../guardrails.js';

export function generateMcpTarget(skill: SkillIR): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  const primaryTool = skill.tools[0];

  const toolsListJson = JSON.stringify(
    skill.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.parameters,
    })),
    null,
    2
  );

  let serverCode = `#!/usr/bin/env node
/**
 * Auto-generated Standalone MCP JSON-RPC 2.0 Server for ${skill.name}
 * Zero External Dependencies (Native Node.js readline/process)
 */
import readline from 'node:readline';

${generateNodeGuardrails(primaryTool)}

const TOOLS = ${toolsListJson};

async function executeTool(name, args) {
  const safeCheck = __vibeAssertSafe(args);
  if (safeCheck.dryRun) {
    return { status: "simulated", message: safeCheck.message };
  }

  // Find tool definition
  const tool = TOOLS.find(t => t.name === name);
  if (!tool) {
    throw new Error(\`Tool '\${name}' not found on this MCP server.\`);
  }

  // Handle execution logic
  console.error(\`[MCP] Invoking tool '\${name}' with arguments:\`, JSON.stringify(args));
  return {
    success: true,
    tool: name,
    result: \`Successfully executed \${name}\`,
    data: args,
    timestamp: new Date().toISOString()
  };
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

function sendResponse(response) {
  process.stdout.write(JSON.stringify(response) + '\\n');
}

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let request;
  try {
    request = JSON.parse(trimmed);
  } catch (err) {
    sendResponse({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error' }
    });
    return;
  }

  const { id, method, params } = request;

  try {
    switch (method) {
      case 'initialize': {
        sendResponse({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: '${skill.name}',
              version: '${skill.version}'
            }
          }
        });
        break;
      }

      case 'notifications/initialized': {
        // Handshake acknowledged - no response required
        break;
      }

      case 'tools/list': {
        sendResponse({
          jsonrpc: '2.0',
          id,
          result: {
            tools: TOOLS
          }
        });
        break;
      }

      case 'tools/call': {
        if (!params || !params.name) {
          sendResponse({
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: 'Missing tool name parameter' }
          });
          return;
        }

        try {
          const res = await executeTool(params.name, params.arguments || {});
          const cleanOutput = __vibeRedactSecrets(JSON.stringify(res, null, 2));
          sendResponse({
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: cleanOutput
                }
              ]
            }
          });
        } catch (execErr) {
          sendResponse({
            jsonrpc: '2.0',
            id,
            result: {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: \`[MCP ERROR] \${execErr.message}\`
                }
              ]
            }
          });
        }
        break;
      }

      default: {
        if (id !== undefined) {
          sendResponse({
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: \`Method '\${method}' not supported\` }
          });
        }
      }
    }
  } catch (err) {
    if (id !== undefined) {
      sendResponse({
        jsonrpc: '2.0',
        id,
        error: { code: -32603, message: err.message }
      });
    }
  }
});

console.error(\`[MCP] ${skill.name} server v${skill.version} active on stdio\`);
`;

  files.push({
    relativePath: 'mcp-server.js',
    content: serverCode,
    description: 'Standalone MCP JSON-RPC 2.0 Stdio Server (Zero Dependency)',
  });

  const mcpConfig = {
    mcpServers: {
      [skill.name]: {
        command: 'node',
        args: [`${skill.name}/mcp-server.js`],
        description: skill.description,
      },
    },
  };

  files.push({
    relativePath: 'mcp-config.json',
    content: JSON.stringify(mcpConfig, null, 2),
    description: 'Claude Desktop / Antigravity MCP Server Configuration Snippet',
  });

  return files;
}
