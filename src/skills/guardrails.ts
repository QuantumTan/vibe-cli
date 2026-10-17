import { SkillTool, ToolRiskLevel } from './types.js';

const DESTRUCTIVE_KEYWORDS = [
  'delete',
  'drop',
  'truncate',
  'destroy',
  'purge',
  'format',
  'rmdir',
  'kill',
  'wipe',
  'overwrite',
  'unlink',
  'remove',
  'terminate',
  'revoke',
  'prune',
];

const PRIVILEGED_KEYWORDS = [
  'sudo',
  'admin',
  'chmod',
  'chown',
  'grant',
  'exec',
  'eval',
  'root',
  'su',
  'elevation',
];

const WRITE_KEYWORDS = [
  'create',
  'update',
  'set',
  'patch',
  'put',
  'write',
  'save',
  'sync',
  'upload',
  'install',
  'touch',
  'build',
  'compile',
  'edit',
  'append',
  'insert',
];

/**
 * Detect risk level based on tool name, description and optional code.
 */
export function detectRiskLevel(name: string, description: string, code = ''): ToolRiskLevel {
  const normalized = `${name} ${description} ${code}`.toLowerCase().replace(/[_.-]/g, ' ');

  for (const kw of DESTRUCTIVE_KEYWORDS) {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    if (regex.test(normalized)) {
      return 'destructive_write';
    }
  }

  for (const kw of PRIVILEGED_KEYWORDS) {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    if (regex.test(normalized)) {
      return 'privileged';
    }
  }

  for (const kw of WRITE_KEYWORDS) {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    if (regex.test(normalized)) {
      return 'idempotent_write';
    }
  }

  return 'read_only';
}

/**
 * Synthesizes deterministic guardrails into tool parameters and config.
 */
export function synthesizeGuardrails(tool: SkillTool): SkillTool {
  const cloned: SkillTool = JSON.parse(JSON.stringify(tool));

  // Initialize guardrails
  cloned.guardrails = {
    blockPathTraversal: true,
    blockSSRF: true,
    secretRedaction: true,
    requireConfirmation: cloned.riskLevel === 'destructive_write' || cloned.riskLevel === 'privileged',
    dryRunSupported: cloned.riskLevel === 'destructive_write' || cloned.riskLevel === 'idempotent_write',
    ...cloned.guardrails,
  };

  // If destructive or privileged, inject confirm parameter
  if (cloned.guardrails.requireConfirmation) {
    if (!cloned.parameters.properties['confirm']) {
      cloned.parameters.properties['confirm'] = {
        type: 'boolean',
        description: 'Safety confirmation required: must be explicitly true to execute this action',
        default: false,
      };
    }
    if (!cloned.parameters.required.includes('confirm')) {
      cloned.parameters.required.push('confirm');
    }
  }

  // If dry-run supported, inject dryRun parameter
  if (cloned.guardrails.dryRunSupported) {
    if (!cloned.parameters.properties['dryRun']) {
      cloned.parameters.properties['dryRun'] = {
        type: 'boolean',
        description: 'Simulate the operation and return anticipated impact without mutating state',
        default: false,
      };
    }
  }

  return cloned;
}

/**
 * Generates runtime guardrail verification preamble for Node.js scripts.
 */
export function generateNodeGuardrails(tool: SkillTool): string {
  const isDestructive = tool.riskLevel === 'destructive_write' || tool.riskLevel === 'privileged';

  return `// --- AUTO-GENERATED VIBE GUARDRAILS ---
function __vibeAssertSafe(params) {
  // 1. Path traversal shield
  const forbiddenPaths = ['..', '/etc', 'c:\\\\windows\\\\system32', '/bin', '/usr/bin', '~/.ssh', '/root'];
  for (const [key, val] of Object.entries(params)) {
    if (typeof val === 'string') {
      const lower = val.toLowerCase().replace(/\\\\/g, '/');
      if (lower.includes('../') || lower.includes('/..') || lower.startsWith('/etc') || lower.includes('system32')) {
        throw new Error(\`[GUARDRAIL ABORT] Path traversal or system directory access prohibited in parameter '\${key}': \${val}\`);
      }
      // 2. SSRF Shield
      if (/^https?:\\/\\//i.test(val)) {
        if (/169\\.254\\.169\\.254|metadata\\.google\\.internal|100\\.100\\.100\\.200/i.test(val)) {
          throw new Error(\`[GUARDRAIL ABORT] SSRF Cloud Metadata IP prohibited in parameter '\${key}': \${val}\`);
        }
      }
    }
  }

  // 3. Destructive confirmation check
  ${isDestructive ? `
  if (params.dryRun === true) {
    console.error("[VIBE DRY-RUN] Simulation mode enabled. Skipping actual destructive mutation.");
    return { dryRun: true, status: "simulated", message: "Dry-run succeeded. No state was altered." };
  }
  if (params.confirm !== true) {
    throw new Error("[GUARDRAIL ABORT] Destructive operation refused: 'confirm: true' was not provided.");
  }
  ` : ''}

  return { dryRun: false };
}

function __vibeRedactSecrets(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/(sk-[a-zA-Z0-9]{20,})/g, '[REDACTED_API_KEY]')
    .replace(/(ghp_[a-zA-Z0-9]{36})/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/(bearer\\s+[a-zA-Z0-9_\\-\\.]+)/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/(password|passwd|secret)\\s*[:=]\\s*["'][^"']+["']/gi, '$1="[REDACTED]"');
}
// ----------------------------------------
`;
}

/**
 * Generates runtime guardrail verification preamble for Python scripts.
 */
export function generatePythonGuardrails(tool: SkillTool): string {
  const isDestructive = tool.riskLevel === 'destructive_write' || tool.riskLevel === 'privileged';

  return `# --- AUTO-GENERATED VIBE GUARDRAILS ---
import re, sys, os

def __vibe_assert_safe(params: dict):
    forbidden = ["..", "/etc", "c:\\\\windows\\\\system32", "/bin", "/usr/bin", "~/.ssh", "/root"]
    for key, val in params.items():
        if isinstance(val, str):
            lower = val.lower().replace("\\\\", "/")
            if "../" in lower or "/.." in lower or lower.startswith("/etc") or "system32" in lower:
                raise PermissionError(f"[GUARDRAIL ABORT] Path traversal prohibited in parameter '{key}': {val}")
            if re.match(r"^https?:\\/\\/", val, re.I):
                if re.search(r"169\\.254\\.169\\.254|metadata\\.google\\.internal", val):
                    raise PermissionError(f"[GUARDRAIL ABORT] SSRF Cloud Metadata IP prohibited in parameter '{key}': {val}")
    ${isDestructive ? `
    if params.get("dryRun") is True:
        sys.stderr.write("[VIBE DRY-RUN] Simulation mode enabled. Skipping destructive mutation.\\n")
        return {"dryRun": True, "status": "simulated"}
    if params.get("confirm") is not True:
        raise PermissionError("[GUARDRAIL ABORT] Destructive operation refused: 'confirm: True' was not provided.")
    ` : ''}
    return {"dryRun": False}

def __vibe_redact_secrets(text: str) -> str:
    if not isinstance(text, str): return text
    text = re.sub(r"sk-[a-zA-Z0-9]{20,}", "[REDACTED_API_KEY]", text)
    text = re.sub(r"ghp_[a-zA-Z0-9]{36}", "[REDACTED_GITHUB_TOKEN]", text)
    text = re.sub(r"bearer\\s+[a-zA-Z0-9_\\-\\.]+", "Bearer [REDACTED_TOKEN]", text, flags=re.I)
    return text
# ----------------------------------------
`;
}
