export interface FreeModelSpec {
  id: string;
  name: string;
  provider: string;
  rpm: number;
  tpm: number;
  rpd: number;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  endpoint?: string;
  cost: '$0';
  resetRule: 'midnight_us_pacific' | 'midnight_utc' | 'rolling' | 'none';
  envKeyRequired?: string;
  signupUrl: string;
}

export const VERIFIED_FREE_PROVIDERS: Record<string, FreeModelSpec> = {
  'gemini-flash': {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini-free',
    rpm: 10,
    tpm: 250000,
    rpd: 250,
    maxInputTokens: 1000000,
    maxOutputTokens: 8192,
    cost: '$0',
    resetRule: 'midnight_us_pacific',
    envKeyRequired: 'GEMINI_API_KEY',
    signupUrl: 'https://aistudio.google.com/app/apikey',
  },
  'groq-llama-8b': {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B (Groq)',
    provider: 'groq-free',
    rpm: 30,
    tpm: 6000,
    rpd: 14400,
    maxInputTokens: 6000,
    maxOutputTokens: 2048,
    cost: '$0',
    resetRule: 'rolling',
    envKeyRequired: 'GROQ_API_KEY',
    signupUrl: 'https://console.groq.com/keys',
  },
  'groq-llama-70b': {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B (Groq)',
    provider: 'groq-free',
    rpm: 30,
    tpm: 12000,
    rpd: 1000,
    maxInputTokens: 8000,
    maxOutputTokens: 4096,
    cost: '$0',
    resetRule: 'rolling',
    envKeyRequired: 'GROQ_API_KEY',
    signupUrl: 'https://console.groq.com/keys',
  },
  'groq-qwen-27b': {
    id: 'qwen/qwen3.6-27b',
    name: 'Qwen 3.6 27B (Groq)',
    provider: 'groq-free',
    rpm: 30,
    tpm: 8000,
    rpd: 1000,
    maxInputTokens: 8000,
    maxOutputTokens: 4096,
    cost: '$0',
    resetRule: 'rolling',
    envKeyRequired: 'GROQ_API_KEY',
    signupUrl: 'https://console.groq.com/keys',
  },
  'github-models': {
    id: 'github-gpt-4o-mini',
    name: 'GitHub Models (PAT)',
    provider: 'github-models',
    rpm: 15,
    tpm: 60000,
    rpd: 150,
    maxInputTokens: 8000, // Hard input token ceiling
    maxOutputTokens: 4000, // Hard output token ceiling
    cost: '$0',
    resetRule: 'rolling',
    envKeyRequired: 'GITHUB_TOKEN',
    signupUrl: 'https://github.com/marketplace/models',
  },
  'openrouter-free': {
    id: 'openrouter/auto:free',
    name: 'OpenRouter Free Tier',
    provider: 'openrouter-free',
    rpm: 20,
    tpm: 40000,
    rpd: 50,
    maxInputTokens: 8000,
    maxOutputTokens: 2048,
    cost: '$0',
    resetRule: 'rolling',
    envKeyRequired: 'OPENROUTER_API_KEY',
    signupUrl: 'https://openrouter.ai/keys',
  },
  'cloudflare-workers-ai': {
    id: '@cf/meta/llama-3.1-8b-instruct',
    name: 'Cloudflare Workers AI',
    provider: 'cloudflare-workers-ai',
    rpm: 60,
    tpm: 100000,
    rpd: 10000, // 10,000 Neurons/day
    maxInputTokens: 4096,
    maxOutputTokens: 2048,
    cost: '$0',
    resetRule: 'midnight_utc',
    signupUrl: 'https://dash.cloudflare.com/ai',
  },
  'local-ollama': {
    id: 'qwen2.5-coder:7b',
    name: 'Local Ollama',
    provider: 'local-ollama',
    rpm: 9999,
    tpm: 9999999,
    rpd: 999999,
    endpoint: 'http://localhost:11434/v1',
    cost: '$0',
    resetRule: 'none',
    signupUrl: 'https://ollama.com/download',
  },
  'local-lmstudio': {
    id: 'local-model',
    name: 'Local LM Studio',
    provider: 'local-lmstudio',
    rpm: 9999,
    tpm: 9999999,
    rpd: 999999,
    endpoint: 'http://localhost:1234/v1',
    cost: '$0',
    resetRule: 'none',
    signupUrl: 'https://lmstudio.ai/',
  },
};
