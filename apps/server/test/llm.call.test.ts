import { describe, expect, it } from 'vitest';
import { APICallError } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { z } from 'zod';
import type { ClientRef, ProjectRef } from '@gestalt/shared';
import { callStructured, rateLimitWaitMs } from '../src/llm/call';
import { postProcessIntent } from '../src/services/intent';

type MockOptions = NonNullable<ConstructorParameters<typeof MockLanguageModelV4>[0]>;
type GenerateResult = Awaited<
  ReturnType<NonNullable<Extract<MockOptions['doGenerate'], (...a: never[]) => unknown>>>
>;

function reply(text: string): GenerateResult {
  return {
    content: [{ type: 'text', text }],
    finishReason: { unified: 'stop', raw: 'stop' },
    usage: {
      inputTokens: { total: 12, noCache: 12, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 6, text: 6, reasoning: 0 },
    },
    warnings: [],
  };
}

/** A mock model that returns the given texts in order and records each prompt it saw. */
function scripted(...texts: string[]) {
  const prompts: string[] = [];
  let i = 0;
  const model = new MockLanguageModelV4({
    doGenerate: async (opts) => {
      prompts.push(JSON.stringify(opts.prompt));
      return reply(texts[Math.min(i++, texts.length - 1)]!);
    },
  });
  return { model, prompts };
}

const Answer = z.object({ answer: z.string().max(10) });
const base = {
  stage: 'intent' as const,
  model: 'mock:test',
  system: 'Return JSON.',
  user: 'Question',
  schema: Answer,
  temperature: 0,
  maxOutputTokens: 100,
  timeoutMs: 2000,
};

describe('callStructured', () => {
  it('returns validated data and call metadata', async () => {
    const { model } = scripted('{"answer":"Paris"}');
    const res = await callStructured({ ...base, languageModel: model });
    expect(res).toMatchObject({
      ok: true,
      data: { answer: 'Paris' },
      meta: { attempts: 1, inputTokens: 12 },
    });
  });

  it('retries once with the validation error appended, then succeeds', async () => {
    const { model, prompts } = scripted(
      '{"answer":"far too long for the schema"}',
      '{"answer":"Paris"}',
    );
    const res = await callStructured({ ...base, languageModel: model });
    expect(res.ok).toBe(true);
    expect(res.meta.attempts).toBe(2);
    expect(prompts[1]).toContain('Your previous output failed validation');
  });

  it('fails after one retry so the caller can fall back', async () => {
    const { model } = scripted('not json', 'still not json');
    const res = await callStructured({ ...base, languageModel: model });
    expect(res.ok).toBe(false);
    expect(res.meta.attempts).toBe(2);
  });

  it('stops without calling the model when already aborted', async () => {
    const { model, prompts } = scripted('{"answer":"Paris"}');
    const ctrl = new AbortController();
    ctrl.abort();
    const res = await callStructured({ ...base, languageModel: model, signal: ctrl.signal });
    expect(res).toMatchObject({ ok: false, error: 'Aborted' });
    expect(prompts).toHaveLength(0);
  });

  const rateLimited = (message: string) =>
    new APICallError({
      message,
      url: 'https://example.test',
      requestBodyValues: {},
      statusCode: 429,
      isRetryable: true,
    });

  it('waits out a short rate limit as its one retry', async () => {
    let calls = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        calls += 1;
        if (calls === 1) throw rateLimited('Rate limit reached. Please try again in 20ms.');
        return reply('{"answer":"Paris"}');
      },
    });
    const res = await callStructured({ ...base, languageModel: model });
    expect(res).toMatchObject({ ok: true, meta: { attempts: 2 } });
  });

  it('falls back at once when the rate limit wait is long', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw rateLimited('Rate limit reached. Please try again in 12.5s.');
      },
    });
    const res = await callStructured({ ...base, languageModel: model });
    expect(res).toMatchObject({ ok: false, meta: { attempts: 1 } });
  });

  it('reads the wait from the provider message', () => {
    expect(rateLimitWaitMs(rateLimited('Please try again in 517.5ms.'))).toBe(517.5);
    expect(rateLimitWaitMs(rateLimited('Please try again in 1.845s.'))).toBe(1845);
    expect(rateLimitWaitMs(new Error('Please try again in 1s'))).toBeNull();
  });
});

describe('intent post-processing (Section 10.2)', () => {
  const clients: ClientRef[] = [{ id: 'acme', name: 'Acme Corp', aliases: ['acme'] }];
  const projects: ProjectRef[] = [{ id: 'proj-x', name: 'X', clientId: 'acme' }];
  const interp = (confidence: number, clientId?: string | null) => ({
    label: 'L',
    shape: 'prepare' as const,
    scope: clientId === undefined ? {} : { clientId },
    confidence,
    rationale: 'r',
  });

  it('drops unknown ids, sorts by confidence and assigns ids', () => {
    const out = postProcessIntent(
      { interpretations: [interp(0.4, 'acme'), interp(0.9, 'nope'), interp(0.7)], isPivot: true },
      { clients, projects },
    );
    expect(out?.interpretations.map((i) => [i.id, i.confidence])).toEqual([
      ['i1', 0.7],
      ['i2', 0.4],
    ]);
    expect(out?.interpretations[0]!.scope).toEqual({});
    expect(out?.isPivot).toBe(true);
  });

  it('keeps explicit null (clear) distinct from omitted (carry over)', () => {
    const out = postProcessIntent(
      { interpretations: [interp(0.9, null)], isPivot: false },
      { clients, projects },
    );
    expect(out?.interpretations[0]!.scope).toEqual({ clientId: null });
  });

  it('returns null when every interpretation is invalid', () => {
    expect(
      postProcessIntent(
        { interpretations: [interp(0.9, 'ghost')], isPivot: false },
        { clients, projects },
      ),
    ).toBeNull();
  });
});
