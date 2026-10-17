import { SkillIR, GeneratedFile } from '../types.js';

export function generateOpenAITarget(skill: SkillIR): GeneratedFile[] {
  const openAiTools = skill.tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: `[Risk: ${t.riskLevel}] ${t.description}`,
      parameters: t.parameters,
    },
  }));

  const anthropicTools = skill.tools.map((t) => ({
    name: t.name,
    description: `[Risk: ${t.riskLevel}] ${t.description}`,
    input_schema: t.parameters,
  }));

  return [
    {
      relativePath: 'openai-tools.json',
      content: JSON.stringify(openAiTools, null, 2),
      description: 'OpenAI Function Calling Tools Specification',
    },
    {
      relativePath: 'anthropic-tools.json',
      content: JSON.stringify(anthropicTools, null, 2),
      description: 'Anthropic Claude Tools Specification',
    },
  ];
}
