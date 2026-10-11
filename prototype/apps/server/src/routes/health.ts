import { Router } from 'express';
import type { HealthResponse } from '@gestalt/shared';
import { getDbState } from '../db/state';
import { env } from '../env';
import { fallbackMode } from '../llm/models';

export function llmMode(): HealthResponse['llm'] {
  return fallbackMode() ? 'fallback' : 'live';
}

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  const body: HealthResponse = {
    ok: true,
    llm: llmMode(),
    models: {
      fast: env.MODEL_FAST,
      write: env.MODEL_WRITE,
      ...(env.MODEL_FAST_FALLBACK ? { fastFallback: env.MODEL_FAST_FALLBACK } : {}),
      ...(env.MODEL_WRITE_FALLBACK ? { writeFallback: env.MODEL_WRITE_FALLBACK } : {}),
    },
    db: getDbState(),
  };
  res.json(body);
});
