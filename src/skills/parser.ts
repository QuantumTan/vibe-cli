import fs from 'fs-extra';
import path from 'path';
import matter from 'gray-matter';
import {
  SkillIR,
  SkillTool,
  ToolParameterSchema,
  JSONSchemaProperty,
  SkillExecutionType,
} from './types.js';
import { detectRiskLevel, synthesizeGuardrails } from './guardrails.js';

/**
 * Parses a Python script into a SkillIR.
 */
export function parsePythonScript(code: string, fileName: string): SkillIR {
  const baseName = path.basename(fileName, path.extname(fileName));
  const skillName = baseName.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();

  // Extract top-level module docstring if present
  let moduleDoc = '';
  const docMatch = code.match(/^(?:"""([\s\S]*?)"""|'''([\s\S]*?)''')/);
  if (docMatch) {
    moduleDoc = (docMatch[1] || docMatch[2] || '').trim();
  }

  // Find functions: def func_name(arg1: type, arg2: type = default):
  const funcRegex = /def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*(?:->\s*[^:]+)?:\s*(?:"""([\s\S]*?)"""|'''([\s\S]*?)''')?/g;
  const tools: SkillTool[] = [];

  let match: RegExpExecArray | null;
  while ((match = funcRegex.exec(code)) !== null) {
    const fnName = match[1];
    if (fnName.startsWith('_')) continue; // Skip private functions

    const rawArgs = match[2].trim();
    const fnDoc = (match[3] || '').trim();

    const properties: Record<string, JSONSchemaProperty> = {};
    const required: string[] = [];

    if (rawArgs.length > 0) {
      const args = rawArgs.split(',').map((a) => a.trim()).filter(Boolean);
      for (const arg of args) {
        if (arg === 'self' || arg === 'cls') continue;

        // arg: str = "default" or arg: int or arg
        const parts = arg.split('=');
        const hasDefault = parts.length > 1;
        const left = parts[0].trim();
        const defaultValue = hasDefault ? parts[1].trim() : undefined;

        const typeSplit = left.split(':');
        const paramName = typeSplit[0].trim();
        const typeHint = typeSplit.length > 1 ? typeSplit[1].trim().toLowerCase() : 'string';

        let jsonType: JSONSchemaProperty['type'] = 'string';
        if (typeHint.includes('int')) jsonType = 'integer';
        else if (typeHint.includes('float') || typeHint.includes('number')) jsonType = 'number';
        else if (typeHint.includes('bool')) jsonType = 'boolean';
        else if (typeHint.includes('list') || typeHint.includes('array')) jsonType = 'array';
        else if (typeHint.includes('dict')) jsonType = 'object';

        properties[paramName] = {
          type: jsonType,
          description: `Parameter '${paramName}' of ${fnName}`,
        };

        if (defaultValue !== undefined) {
          try {
            properties[paramName].default = JSON.parse(defaultValue.replace(/'/g, '"'));
          } catch {
            properties[paramName].default = defaultValue;
          }
        } else {
          required.push(paramName);
        }
      }
    }

    const description = fnDoc || `${fnName} utility function`;
    const riskLevel = detectRiskLevel(fnName, description, code);

    const tool: SkillTool = {
      id: fnName,
      name: fnName,
      description,
      riskLevel,
      parameters: {
        type: 'object',
        properties,
        required,
      },
      execution: {
        type: 'python',
        entrypoint: fileName,
        code,
      },
      guardrails: {},
    };

    tools.push(synthesizeGuardrails(tool));
  }

  // Fallback if no functions were found: wrap entire script as 1 tool
  if (tools.length === 0) {
    const description = moduleDoc || `Execute ${fileName} python script`;
    const riskLevel = detectRiskLevel(skillName, description, code);
    const tool: SkillTool = {
      id: skillName,
      name: skillName,
      description,
      riskLevel,
      parameters: {
        type: 'object',
        properties: {
          args: {
            type: 'array',
            description: 'Command line arguments to pass to the script',
            items: { type: 'string' },
          },
        },
        required: [],
      },
      execution: {
        type: 'python',
        entrypoint: fileName,
        code,
      },
      guardrails: {},
    };
    tools.push(synthesizeGuardrails(tool));
  }

  return {
    name: skillName,
    version: '1.0.0',
    description: moduleDoc || `Skill compiled from ${fileName}`,
    tools,
  };
}

/**
 * Parses a TypeScript or JavaScript script into a SkillIR.
 */
export function parseTypeScriptScript(code: string, fileName: string): SkillIR {
  const baseName = path.basename(fileName, path.extname(fileName));
  const skillName = baseName.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();

  // Find exported functions
  const funcRegex = /(?:\/\*\*([\s\S]*?)\*\/[\s\n]*)?export\s+(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/g;
  const tools: SkillTool[] = [];

  let match: RegExpExecArray | null;
  while ((match = funcRegex.exec(code)) !== null) {
    const jsDoc = (match[1] || '').trim();
    const fnName = match[2];
    const rawArgs = match[3].trim();

    // Extract description from JSDoc
    let description = '';
    const descLines: string[] = [];
    const paramDocs: Record<string, string> = {};

    if (jsDoc) {
      for (const line of jsDoc.split('\n')) {
        const cleaned = line.replace(/^\s*\*\s?/, '').trim();
        const paramMatch = cleaned.match(/@param\s+(?:\{[^}]+\}\s+)?([a-zA-Z0-9_]+)\s*(.*)/);
        if (paramMatch) {
          paramDocs[paramMatch[1]] = paramMatch[2].trim();
        } else if (!cleaned.startsWith('@')) {
          descLines.push(cleaned);
        }
      }
      description = descLines.join(' ').trim();
    }

    if (!description) {
      description = `${fnName} function`;
    }

    const properties: Record<string, JSONSchemaProperty> = {};
    const required: string[] = [];

    if (rawArgs.length > 0) {
      const args = rawArgs.split(',').map((a) => a.trim()).filter(Boolean);
      for (const arg of args) {
        // arg: type = default
        const parts = arg.split('=');
        const hasDefault = parts.length > 1;
        const left = parts[0].trim();
        const defaultValue = hasDefault ? parts[1].trim() : undefined;

        const typeSplit = left.split(':');
        const paramName = typeSplit[0].replace('?', '').trim();
        const isOptional = left.includes('?') || hasDefault;
        const typeHint = typeSplit.length > 1 ? typeSplit[1].trim().toLowerCase() : 'string';

        let jsonType: JSONSchemaProperty['type'] = 'string';
        if (typeHint.includes('number')) jsonType = 'number';
        else if (typeHint.includes('boolean')) jsonType = 'boolean';
        else if (typeHint.includes('[]') || typeHint.includes('array')) jsonType = 'array';
        else if (typeHint.includes('object') || typeHint.includes('record')) jsonType = 'object';

        properties[paramName] = {
          type: jsonType,
          description: paramDocs[paramName] || `Parameter '${paramName}' of ${fnName}`,
        };

        if (defaultValue !== undefined) {
          try {
            properties[paramName].default = JSON.parse(defaultValue.replace(/'/g, '"'));
          } catch {
            properties[paramName].default = defaultValue;
          }
        }

        if (!isOptional) {
          required.push(paramName);
        }
      }
    }

    const riskLevel = detectRiskLevel(fnName, description, code);

    const tool: SkillTool = {
      id: fnName,
      name: fnName,
      description,
      riskLevel,
      parameters: {
        type: 'object',
        properties,
        required,
      },
      execution: {
        type: 'node',
        entrypoint: fileName,
        code,
      },
      guardrails: {},
    };

    tools.push(synthesizeGuardrails(tool));
  }

  if (tools.length === 0) {
    // Single tool fallback
    const riskLevel = detectRiskLevel(skillName, `Run ${fileName}`, code);
    const tool: SkillTool = {
      id: skillName,
      name: skillName,
      description: `Execute ${fileName} node module`,
      riskLevel,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      execution: {
        type: 'node',
        entrypoint: fileName,
        code,
      },
      guardrails: {},
    };
    tools.push(synthesizeGuardrails(tool));
  }

  return {
    name: skillName,
    version: '1.0.0',
    description: `Skill compiled from ${fileName}`,
    tools,
  };
}

/**
 * Parses natural language intent into a structured SkillIR.
 */
export function parseNaturalLanguageIntent(intent: string, name?: string): SkillIR {
  const sanitizedName = (name || intent.slice(0, 30))
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'custom-skill';

  const riskLevel = detectRiskLevel(sanitizedName, intent);

  // Extract parameters mentioned like: "given <param>", "with <param>", "accepts <param>"
  const properties: Record<string, JSONSchemaProperty> = {};
  const required: string[] = [];

  const paramRegex = /(?:given|with|accepts|parameters?|args?|options?|for)\s+([a-zA-Z0-9_,\s]+)(?:$|\.|\n)/gi;
  const paramMatch = paramRegex.exec(intent);

  if (paramMatch) {
    const rawParams = paramMatch[1].split(/,|and/).map((p) => p.trim()).filter((p) => p.length > 0 && p.length < 30);
    for (const p of rawParams) {
      const pClean = p.replace(/[^a-zA-Z0-9_]/g, '');
      if (pClean && !properties[pClean]) {
        let type: JSONSchemaProperty['type'] = 'string';
        if (/^(num|count|limit|days|port|id)|(num|count|limit|days|port|id)$/i.test(pClean)) type = 'number';
        if (/^(is|has|should|can|enable|force|dry)|(flag|force|dry|enabled)$/i.test(pClean)) type = 'boolean';

        properties[pClean] = {
          type,
          description: `Extracted parameter '${pClean}'`,
        };
        required.push(pClean);
      }
    }
  }

  if (Object.keys(properties).length === 0) {
    properties['input'] = {
      type: 'string',
      description: 'Primary input for the skill',
    };
    required.push('input');
  }

  const tool: SkillTool = {
    id: sanitizedName,
    name: sanitizedName,
    description: intent,
    riskLevel,
    parameters: {
      type: 'object',
      properties,
      required,
    },
    execution: {
      type: 'node',
      code: `// Implementation for ${intent}\nexport async function run(params) {\n  console.log("Executing ${sanitizedName} with:", params);\n  return { success: true, result: "Executed successfully" };\n}`,
    },
    guardrails: {},
  };

  return {
    name: sanitizedName,
    version: '1.0.0',
    description: intent,
    tools: [synthesizeGuardrails(tool)],
  };
}

/**
 * Parses any input file or string into a SkillIR.
 */
export async function parseSkillInput(input: string, sourcePath?: string): Promise<SkillIR> {
  // 1. If it's an existing file
  if (sourcePath && (await fs.pathExists(sourcePath))) {
    const stat = await fs.stat(sourcePath);
    if (stat.isFile()) {
      const content = await fs.readFile(sourcePath, 'utf8');
      const ext = path.extname(sourcePath).toLowerCase();

      if (ext === '.py') {
        return parsePythonScript(content, sourcePath);
      } else if (ext === '.ts' || ext === '.js' || ext === '.mjs') {
        return parseTypeScriptScript(content, sourcePath);
      } else if (ext === '.json') {
        const parsed = JSON.parse(content);
        if (parsed.name && parsed.tools) {
          parsed.tools = parsed.tools.map((t: SkillTool) => synthesizeGuardrails(t));
          return parsed as SkillIR;
        }
      } else if (ext === '.md') {
        const parsed = matter(content);
        if (parsed.data.name) {
          return {
            name: parsed.data.name,
            version: parsed.data.version || '1.0.0',
            description: parsed.data.description || parsed.content.slice(0, 100),
            tools: (parsed.data.tools || []).map((t: SkillTool) => synthesizeGuardrails(t)),
          };
        }
      }
    }
  }

  // 2. Try JSON parsing directly
  try {
    const parsed = JSON.parse(input);
    if (parsed.name && parsed.tools) {
      parsed.tools = parsed.tools.map((t: SkillTool) => synthesizeGuardrails(t));
      return parsed as SkillIR;
    }
  } catch {
    // Not raw JSON
  }

  // 3. Fallback: Treat as Natural Language Intent
  return parseNaturalLanguageIntent(input);
}
