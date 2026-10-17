import path from 'path';
import fs from 'fs-extra';
import matter from 'gray-matter';
import { SkillAuditReport, SkillAuditFinding, SkillIR } from './types.js';
import { parseSkillInput } from './parser.js';

/**
 * Runs static security, safety guardrail, and schema quality audit on a skill.
 */
export async function auditSkill(targetPathOrName: string): Promise<SkillAuditReport> {
  const trimmed = targetPathOrName.trim();
  let skill: SkillIR;

  if (trimmed.startsWith('---') || trimmed.startsWith('{')) {
    skill = await parseSkillInput(trimmed);
  } else {
    const resolvedPath = path.resolve(targetPathOrName);
    if (await fs.pathExists(resolvedPath)) {
      const stat = await fs.stat(resolvedPath);
      if (stat.isDirectory()) {
        const skillMd = path.join(resolvedPath, 'SKILL.md');
        if (await fs.pathExists(skillMd)) {
          skill = await parseSkillInput(await fs.readFile(skillMd, 'utf8'), skillMd);
        } else {
          throw new Error(`Directory ${targetPathOrName} does not contain a SKILL.md file.`);
        }
      } else {
        skill = await parseSkillInput(await fs.readFile(resolvedPath, 'utf8'), resolvedPath);
      }
    } else {
    // Check in .vault/Skills/ or ./skills/
    const cwd = process.cwd();
    const vaultSkill = path.join(cwd, '.vault', 'Skills', targetPathOrName);
    const localSkill = path.join(cwd, 'skills', targetPathOrName);

    if (await fs.pathExists(vaultSkill)) {
      return auditSkill(vaultSkill);
    } else if (await fs.pathExists(localSkill)) {
      return auditSkill(localSkill);
    } else {
      throw new Error(`Skill '${targetPathOrName}' not found in current directory, .vault/Skills/, or ./skills/.`);
    }
  }
}

  const findings: SkillAuditFinding[] = [];
  let score = 100;

  // 1. Audit Tool Parameters & Schema Hygiene
  for (const tool of skill.tools) {
    const props = tool.parameters.properties || {};

    if (Object.keys(props).length === 0) {
      findings.push({
        id: `schema-empty-${tool.name}`,
        category: 'schema',
        level: 'warning',
        message: `Tool '${tool.name}' defines zero parameters. Agents may invoke it blind.`,
        recommendation: 'Add explicit parameter definitions or document why no input is required.',
      });
      score -= 5;
    }

    for (const [pName, pDef] of Object.entries(props)) {
      if (!pDef.description || pDef.description.trim().length < 5) {
        findings.push({
          id: `schema-desc-${tool.name}-${pName}`,
          category: 'schema',
          level: 'info',
          message: `Parameter '${pName}' in tool '${tool.name}' lacks a descriptive explanation.`,
          recommendation: 'Provide clear context for the LLM on valid parameter values and purpose.',
        });
        score -= 2;
      }
    }

    // 2. Destructive Guardrail Verification
    if (tool.riskLevel === 'destructive_write' || tool.riskLevel === 'privileged') {
      const hasConfirm = !!props['confirm'];
      const isConfirmReq = tool.parameters.required?.includes('confirm');

      if (!hasConfirm || !isConfirmReq) {
        findings.push({
          id: `guardrail-missing-confirm-${tool.name}`,
          category: 'guardrails',
          level: 'critical',
          message: `Destructive tool '${tool.name}' is missing mandatory 'confirm: true' safety gate.`,
          recommendation: 'Inject confirm parameter and require explicit true confirmation before mutating.',
        });
        score -= 25;
      }

      if (!props['dryRun']) {
        findings.push({
          id: `guardrail-missing-dryrun-${tool.name}`,
          category: 'guardrails',
          level: 'warning',
          message: `Destructive tool '${tool.name}' does not advertise 'dryRun' simulation support.`,
          recommendation: 'Implement dry-run preview so agents can simulate impact before executing.',
        });
        score -= 5;
      }
    }

    // 3. Secret Leakage Static Check
    const codeStr = tool.execution?.code || '';
    if (/sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}/.test(codeStr)) {
      findings.push({
        id: `security-hardcoded-secret-${tool.name}`,
        category: 'security',
        level: 'critical',
        message: `Tool '${tool.name}' execution code contains what appears to be a hardcoded API key or token!`,
        recommendation: 'Move credentials into environment variables or secrets manager.',
      });
      score -= 35;
    }
  }

  score = Math.max(0, Math.min(100, score));

  let grade: SkillAuditReport['grade'] = 'F';
  if (score >= 95) grade = 'A+';
  else if (score >= 85) grade = 'A';
  else if (score >= 70) grade = 'B';
  else if (score >= 50) grade = 'C';

  return {
    skillName: skill.name,
    score,
    grade,
    toolsCount: skill.tools.length,
    findings,
  };
}
