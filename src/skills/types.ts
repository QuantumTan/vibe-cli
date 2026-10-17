export type ToolRiskLevel = 'read_only' | 'idempotent_write' | 'destructive_write' | 'privileged';

export interface JSONSchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description?: string;
  default?: any;
  enum?: string[];
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
}

export interface ToolParameterSchema {
  type: 'object';
  properties: Record<string, JSONSchemaProperty>;
  required: string[];
}

export type SkillExecutionType = 'node' | 'python' | 'bash' | 'powershell' | 'inline';

export interface SkillExecution {
  type: SkillExecutionType;
  entrypoint?: string;
  code?: string;
  env?: Record<string, string>;
  dependencies?: string[];
}

export interface SkillGuardrailConfig {
  requireConfirmation?: boolean;
  dryRunSupported?: boolean;
  blockPathTraversal?: boolean;
  blockSSRF?: boolean;
  secretRedaction?: boolean;
  allowedPaths?: string[];
}

export interface SkillTool {
  id: string;
  name: string;
  description: string;
  riskLevel: ToolRiskLevel;
  parameters: ToolParameterSchema;
  execution: SkillExecution;
  guardrails: SkillGuardrailConfig;
}

export type SkillTarget = 'all' | 'antigravity' | 'mcp' | 'cursor' | 'openai';

export interface SkillIR {
  name: string;
  version: string;
  description: string;
  author?: string;
  tags?: string[];
  tools: SkillTool[];
  metadata?: Record<string, any>;
}

export interface GeneratedFile {
  relativePath: string;
  content: string;
  description: string;
}

export interface CompilationResult {
  skill: SkillIR;
  target: SkillTarget;
  files: GeneratedFile[];
  warnings: string[];
}

export interface SkillTestCase {
  name: string;
  category: 'path_traversal' | 'ssrf' | 'destructive_lock' | 'dry_run' | 'valid_execution';
  inputParams: Record<string, any>;
  expectedOutcome: 'pass' | 'blocked' | 'simulated';
  actualOutcome?: string;
  passed: boolean;
  message?: string;
}

export interface SkillTestReport {
  skillName: string;
  runnerPath: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  success: boolean;
  cases: SkillTestCase[];
}

export interface SkillAuditFinding {
  id: string;
  category: 'security' | 'schema' | 'guardrails' | 'commercial';
  level: 'critical' | 'warning' | 'info';
  message: string;
  recommendation: string;
}

export interface SkillAuditReport {
  skillName: string;
  score: number; // 0 - 100
  grade: 'A+' | 'A' | 'B' | 'C' | 'F';
  toolsCount: number;
  findings: SkillAuditFinding[];
}
