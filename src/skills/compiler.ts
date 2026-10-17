import fs from 'fs-extra';
import path from 'path';
import {
  SkillIR,
  SkillTarget,
  CompilationResult,
  GeneratedFile,
} from './types.js';
import { parseSkillInput } from './parser.js';
import { generateAntigravityTarget } from './generators/antigravity.js';
import { generateMcpTarget } from './generators/mcp.js';
import { generateCursorTarget } from './generators/cursor.js';
import { generateOpenAITarget } from './generators/openai.js';
import { generateOpenCodeTarget } from './generators/opencode.js';
import { generateHermesTarget } from './generators/hermes.js';
import { generateGooseTarget } from './generators/goose.js';
import { generateClaudeCodeTarget } from './generators/claudecode.js';
import { generateOpenHandsTarget } from './generators/openhands.js';
import { generateAiderTarget } from './generators/aider.js';
import { generateContinueTarget } from './generators/continue.js';

export interface CompileOptions {
  target?: SkillTarget;
  outDir?: string;
  sourcePath?: string;
  writeFiles?: boolean;
}

/**
 * Core multi-target skill compiler for Vibe Engine.
 */
export async function compileSkill(
  input: string,
  options: CompileOptions = {}
): Promise<CompilationResult> {
  const target = options.target || 'all';
  const warnings: string[] = [];

  // 1. Ingestion & IR synthesis
  const skill: SkillIR = await parseSkillInput(input, options.sourcePath);

  if (!skill.tools || skill.tools.length === 0) {
    warnings.push(`No tools were identified in skill '${skill.name}'. A default runner was generated.`);
  }

  // Check risk levels for auditing
  const destructiveTools = skill.tools.filter((t) => t.riskLevel === 'destructive_write');
  if (destructiveTools.length > 0) {
    warnings.push(
      `Detected ${destructiveTools.length} destructive tool(s) (${destructiveTools.map((t) => t.name).join(', ')}). Injected mandatory 'confirm: true' safety guardrail.`
    );
  }

  // 2. Multi-target code generation
  const files: GeneratedFile[] = [];

  if (target === 'all' || target === 'antigravity') {
    files.push(...generateAntigravityTarget(skill));
  }

  if (target === 'all' || target === 'mcp') {
    files.push(...generateMcpTarget(skill));
  }

  if (target === 'all' || target === 'cursor') {
    files.push(...generateCursorTarget(skill));
  }

  if (target === 'all' || target === 'openai') {
    files.push(...generateOpenAITarget(skill));
  }

  if (target === 'all' || target === 'opencode') {
    files.push(...generateOpenCodeTarget(skill));
  }

  if (target === 'all' || target === 'hermes') {
    files.push(...generateHermesTarget(skill));
  }

  if (target === 'all' || target === 'goose') {
    files.push(...generateGooseTarget(skill));
  }

  if (target === 'all' || target === 'claudecode') {
    files.push(...generateClaudeCodeTarget(skill));
  }

  if (target === 'all' || target === 'openhands') {
    files.push(...generateOpenHandsTarget(skill));
  }

  if (target === 'all' || target === 'aider') {
    files.push(...generateAiderTarget(skill));
  }

  if (target === 'all' || target === 'continue') {
    files.push(...generateContinueTarget(skill));
  }

  // 3. Write files if outDir requested
  if (options.writeFiles && options.outDir) {
    const baseDir = path.resolve(options.outDir);
    await fs.ensureDir(baseDir);

    for (const file of files) {
      const fullPath = path.join(baseDir, file.relativePath);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, file.content, 'utf8');
    }
  }

  return {
    skill,
    target,
    files,
    warnings,
  };
}
