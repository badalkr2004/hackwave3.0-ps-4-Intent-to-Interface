import { APICallError, NoObjectGeneratedError, Output, generateText, type LanguageModel } from 'ai';
import type { z } from 'zod';
import { log } from '../log';
import { providerOptions, resolveModel } from './models';

export type Stage = 'intent' | 'plan' | 'copy';

export interface CallMeta {
  stage: Stage;
  model: string;
  latencyMs: number;
  attempts: number;
  relaxed: boolean;
  inputTokens?: number;
  outputTokens?: number;
}

export type CallResult<T> =
  { ok: true; data: T; meta: CallMeta } | { ok: false; error: string; meta: CallMeta };

export interface CallOptions<T> {
  stage: Stage;
  /** `provider:modelId` */
  model: string;
  system: string;
  user: string;
  /** Strict schema: every result is re-validated against it. */
  schema: z.ZodType<T>;
  /** Same shape without length/count bounds, sent if the provider rejects the strict one. */
  wireSchema?: z.ZodType;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
  signal?: AbortSignal;
  /** Test hook: use this model instead of resolving `model` from the registry. */
  languageModel?: LanguageModel;
}

const MAX_ATTEMPTS = 2;

function summarize(issues: z.core.$ZodIssue[]): string {
  return issues
    .slice(0, 5)
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ');
}

const isSchemaRejection = (err: unknown) =>
  APICallError.isInstance(err) &&
  (err.statusCode === 400 || err.statusCode === 422) &&
  /schema|json_schema|response_format|minItems|maxItems|maxLength|minimum|maximum/i.test(
    err.message,
  );

/** Longest provider-requested rate-limit wait we absorb; longer waits fall back immediately. */
const MAX_RATE_LIMIT_WAIT_MS = 2500;

/** Milliseconds a 429 asks us to wait, from `retry-after` or the provider's message. */
export function rateLimitWaitMs(err: unknown): number | null {
  if (!APICallError.isInstance(err) || err.statusCode !== 429) return null;
  const header = Number(err.responseHeaders?.['retry-after']);
  if (Number.isFinite(header) && header >= 0) return header * 1000;
  const m = /try again in ([\d.]+)\s*(ms|s)\b/i.exec(err.message);
  if (!m) return null;
  return Number(m[1]) * (m[2]?.toLowerCase() === 'ms' ? 1 : 1000);
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => (clearTimeout(t), resolve()), { once: true });
  });

/**
 * One structured LLM call: timeout, re-validation with Zod, and a single corrective retry.
 * Never throws; callers fall back on `ok: false`.
 */
export async function callStructured<T>(opts: CallOptions<T>): Promise<CallResult<T>> {
  const started = performance.now();
  const meta: CallMeta = {
    stage: opts.stage,
    model: opts.model,
    latencyMs: 0,
    attempts: 0,
    relaxed: false,
  };
  const finish = (r: CallResult<T>): CallResult<T> => {
    meta.latencyMs = Math.round(performance.now() - started);
    log.debug('llm call', { ...meta, ok: r.ok, ...(r.ok ? {} : { error: r.error }) });
    return r;
  };

  let model: LanguageModel;
  try {
    model = opts.languageModel ?? resolveModel(opts.model);
  } catch (err) {
    return finish({ ok: false, error: `Model unavailable: ${String(err)}`, meta });
  }

  let prompt = opts.user;
  let lastError = 'No attempts made';
  while (meta.attempts < MAX_ATTEMPTS) {
    meta.attempts += 1;
    if (opts.signal?.aborted) return finish({ ok: false, error: 'Aborted', meta });
    const signal = AbortSignal.any(
      [AbortSignal.timeout(opts.timeoutMs), opts.signal].filter((s): s is AbortSignal => !!s),
    );
    try {
      const result = await generateText({
        model,
        system: opts.system,
        prompt,
        output: Output.object({
          schema: meta.relaxed && opts.wireSchema ? opts.wireSchema : opts.schema,
        }),
        temperature: opts.temperature,
        maxOutputTokens: opts.maxOutputTokens,
        maxRetries: 0,
        abortSignal: signal,
        providerOptions: providerOptions(opts.model),
      });
      meta.inputTokens = result.totalUsage.inputTokens;
      meta.outputTokens = result.totalUsage.outputTokens;
      const parsed = opts.schema.safeParse(result.output);
      if (parsed.success) return finish({ ok: true, data: parsed.data, meta });
      lastError = summarize(parsed.error.issues);
    } catch (err) {
      if (opts.signal?.aborted) return finish({ ok: false, error: 'Aborted', meta });
      if (isSchemaRejection(err) && opts.wireSchema && !meta.relaxed) {
        meta.relaxed = true;
        meta.attempts -= 1;
        continue;
      }
      const wait = rateLimitWaitMs(err);
      if (wait !== null && wait <= MAX_RATE_LIMIT_WAIT_MS && meta.attempts < MAX_ATTEMPTS) {
        lastError = 'Rate limited';
        await sleep(wait + 100, opts.signal);
        continue;
      }
      if (!NoObjectGeneratedError.isInstance(err)) {
        return finish({ ok: false, error: err instanceof Error ? err.message : String(err), meta });
      }
      lastError = err.message;
    }
    prompt = `${opts.user}\n\nYour previous output failed validation: ${lastError}. Return corrected output.`;
  }
  return finish({ ok: false, error: lastError, meta });
}
