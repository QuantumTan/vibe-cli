import fs from 'fs-extra';
import path from 'path';
import { SkillIR, SkillTool, JSONSchemaProperty } from './types.js';
import { detectRiskLevel, synthesizeGuardrails } from './guardrails.js';

/**
 * Parses an OpenAPI 3.0 or Swagger 2.0 specification into a SkillIR.
 */
export async function parseOpenAPISpec(specPathOrUrl: string): Promise<SkillIR> {
  let content = '';

  const trimmed = specPathOrUrl.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('openapi:') || trimmed.startsWith('swagger:')) {
    content = trimmed;
  } else if (/^https?:\/\//i.test(specPathOrUrl)) {
    const res = await fetch(specPathOrUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch OpenAPI spec from ${specPathOrUrl}: HTTP ${res.status}`);
    }
    content = await res.text();
  } else {
    const resolved = path.resolve(specPathOrUrl);
    if (!(await fs.pathExists(resolved))) {
      throw new Error(`OpenAPI spec file not found: ${resolved}`);
    }
    content = await fs.readFile(resolved, 'utf8');
  }

  let spec: any;
  try {
    spec = JSON.parse(content);
  } catch (err: any) {
    throw new Error(`Failed to parse OpenAPI JSON specification: ${err.message}`);
  }

  const title = spec.info?.title || 'api-skill';
  const skillName = title.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  const version = spec.info?.version || '1.0.0';
  const description = spec.info?.description || `AI agent tools generated from OpenAPI spec ${title}`;

  // Determine base URL
  let baseUrl = '';
  if (spec.servers && spec.servers.length > 0) {
    baseUrl = spec.servers[0].url || '';
  } else if (spec.host) {
    const scheme = spec.schemes ? spec.schemes[0] : 'https';
    baseUrl = `${scheme}://${spec.host}${spec.basePath || ''}`;
  }

  const tools: SkillTool[] = [];
  const paths = spec.paths || {};

  for (const [routePath, pathItem] of Object.entries<any>(paths)) {
    const methods = ['get', 'post', 'put', 'delete', 'patch'];

    for (const method of methods) {
      const op = pathItem[method];
      if (!op) continue;

      const opId =
        op.operationId ||
        `${method}_${routePath.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}`;

      const toolDescription = op.summary || op.description || `${method.toUpperCase()} ${routePath}`;
      const methodRisk =
        method === 'delete'
          ? 'destructive_write'
          : method === 'get'
          ? 'read_only'
          : 'idempotent_write';

      const detectedRisk = detectRiskLevel(opId, toolDescription);
      const riskLevel = methodRisk === 'destructive_write' ? 'destructive_write' : detectedRisk;

      const properties: Record<string, JSONSchemaProperty> = {};
      const required: string[] = [];

      // Extract path & query parameters
      const params = [...(pathItem.parameters || []), ...(op.parameters || [])];
      for (const p of params) {
        if (!p.name) continue;
        const schema = p.schema || {};
        let type: JSONSchemaProperty['type'] = 'string';
        if (schema.type === 'integer') type = 'integer';
        else if (schema.type === 'number') type = 'number';
        else if (schema.type === 'boolean') type = 'boolean';
        else if (schema.type === 'array') type = 'array';
        else if (schema.type === 'object') type = 'object';

        properties[p.name] = {
          type,
          description: p.description || `Parameter '${p.name}' in ${p.in || 'query'}`,
        };

        if (schema.default !== undefined) properties[p.name].default = schema.default;
        if (schema.enum) properties[p.name].enum = schema.enum;

        if (p.required) required.push(p.name);
      }

      // Extract JSON requestBody properties
      const reqBody = op.requestBody?.content?.['application/json']?.schema;
      if (reqBody && reqBody.properties) {
        for (const [bodyKey, bodyProp] of Object.entries<any>(reqBody.properties)) {
          let type: JSONSchemaProperty['type'] = 'string';
          if (bodyProp.type === 'integer') type = 'integer';
          else if (bodyProp.type === 'number') type = 'number';
          else if (bodyProp.type === 'boolean') type = 'boolean';
          else if (bodyProp.type === 'array') type = 'array';
          else if (bodyProp.type === 'object') type = 'object';

          properties[bodyKey] = {
            type,
            description: bodyProp.description || `Body parameter '${bodyKey}'`,
          };

          if (bodyProp.default !== undefined) properties[bodyKey].default = bodyProp.default;
          if (bodyProp.enum) properties[bodyKey].enum = bodyProp.enum;

          if (reqBody.required && Array.isArray(reqBody.required) && reqBody.required.includes(bodyKey)) {
            if (!required.includes(bodyKey)) required.push(bodyKey);
          }
        }
      }

      const executionCode = `// API Call for ${opId}\nexport async function run(params) {\n  const url = "${baseUrl}${routePath}";\n  console.error("Calling ${method.toUpperCase()} " + url);\n  return { success: true, endpoint: "${routePath}", method: "${method.toUpperCase()}", params };\n}`;

      const rawTool: SkillTool = {
        id: opId,
        name: opId,
        description: toolDescription,
        riskLevel,
        parameters: {
          type: 'object',
          properties,
          required,
        },
        execution: {
          type: 'node',
          code: executionCode,
        },
        guardrails: {},
      };

      tools.push(synthesizeGuardrails(rawTool));
    }
  }

  return {
    name: skillName,
    version,
    description,
    tools,
  };
}
