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
