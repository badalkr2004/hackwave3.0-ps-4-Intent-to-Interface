import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import { createProviderRegistry, type LanguageModel } from 'ai';
import { env } from '../env';

// Register only providers whose API key is present (SDK default env names).
const providers = {
  ...(env.ANTHROPIC_API_KEY
    ? { anthropic: createAnthropic({ apiKey: env.ANTHROPIC_API_KEY }) }
    : {}),
  ...(env.OPENAI_API_KEY ? { openai: createOpenAI({ apiKey: env.OPENAI_API_KEY }) } : {}),
  ...(env.GROQ_API_KEY ? { groq: createGroq({ apiKey: env.GROQ_API_KEY }) } : {}),
  ...(env.GOOGLE_API_KEY
    ? { google: createGoogleGenerativeAI({ apiKey: env.GOOGLE_API_KEY }) }
    : {}),
};

const registry = createProviderRegistry(providers);

/** `provider:modelId`, e.g. "google:gemini-3.8-flash" or "groq:openai/gpt-oss-120b". */
export function resolveModel(spec: string): LanguageModel {
  return registry.languageModel(spec as `${keyof typeof providers & string}:${string}`);
}

export function llmAvailable(spec: string): boolean {
  return (spec.split(':')[0] ?? '') in providers;
}

/** True when the app should run on fixtures and rules only. */
export function fallbackMode(): boolean {
  return env.FORCE_FALLBACK || !llmAvailable(env.MODEL_FAST) || !llmAvailable(env.MODEL_WRITE);
}

/** Secondary model for a primary `provider:modelId` when the primary call fails. */
export function fallbackModelFor(primary: string): string | undefined {
  const fb =
    primary === env.MODEL_FAST
      ? env.MODEL_FAST_FALLBACK
      : primary === env.MODEL_WRITE
        ? env.MODEL_WRITE_FALLBACK
        : undefined;
  if (!fb || fb === primary || !llmAvailable(fb)) return undefined;
  return fb;
}

/** The single place for provider-specific tuning. */
export function providerOptions(
  modelSpec: string,
): Record<string, Record<string, string | boolean>> | undefined {
  const [provider, ...rest] = modelSpec.split(':');
  const modelId = rest.join(':');
  if (provider === 'groq') {
    // Groq's strict mode demands every property be required, which would erase the difference
    // between an omitted scope field (inherit) and null (clear). Zod re-validates every result.
    // gpt-oss is a reasoning model: low effort keeps it inside the token budget and timeouts.
    return {
      groq: {
        strictJsonSchema: false,
        ...(modelId.includes('gpt-oss') ? { reasoningEffort: 'low' } : {}),
      },
    };
  }
  return undefined;
}
