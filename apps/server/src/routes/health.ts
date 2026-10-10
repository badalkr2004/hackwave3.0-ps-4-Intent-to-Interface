import { Router } from 'express';
import type { HealthResponse } from '@gestalt/shared';
import { env } from '../env';

const PROVIDER_KEYS: Record<string, string | undefined> = {
  anthropic: env.ANTHROPIC_API_KEY,
  openai: env.OPENAI_API_KEY,
  groq: env.GROQ_API_KEY,
};

function providerConfigured(modelSpec: string): boolean {
  const provider = modelSpec.split(':')[0] ?? '';
  return Boolean(PROVIDER_KEYS[provider]);
}

export function llmMode(): HealthResponse['llm'] {
  if (env.FORCE_FALLBACK) return 'fallback';
  return providerConfigured(env.MODEL_FAST) && providerConfigured(env.MODEL_WRITE)
    ? 'live'
    : 'fallback';
}

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  const body: HealthResponse = {
    ok: true,
    llm: llmMode(),
    models: { fast: env.MODEL_FAST, write: env.MODEL_WRITE },
    // Database wiring lands in the next milestone; until then the server reports fixture mode.
    db: 'down',
  };
  res.json(body);
});
