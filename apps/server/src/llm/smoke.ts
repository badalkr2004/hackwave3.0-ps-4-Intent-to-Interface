import { z } from 'zod';
import { env } from '../env';
import { callStructured, type Stage } from './call';
import { llmAvailable } from './models';

// `bun run llm:smoke`: one tiny structured call per stage against the configured models.

const Probe = z.object({ answer: z.string().max(40), confidence: z.number().min(0).max(1) });

const stages: { stage: Stage; model: string; timeoutMs: number }[] = [
  { stage: 'intent', model: env.MODEL_FAST, timeoutMs: 6000 },
  { stage: 'plan', model: env.MODEL_FAST, timeoutMs: 6000 },
  { stage: 'copy', model: env.MODEL_WRITE, timeoutMs: 15000 },
];

let failed = 0;
for (const { stage, model, timeoutMs } of stages) {
  if (!llmAvailable(model)) {
    console.log(`${stage.padEnd(6)} ${model}  FAIL  no API key for this provider`);
    failed += 1;
    continue;
  }
  const res = await callStructured({
    stage,
    model,
    system: 'Answer with the requested JSON only.',
    user: 'What is the capital of France? Give a one-word answer and your confidence from 0 to 1.',
    schema: Probe,
    temperature: 0,
    maxOutputTokens: 400,
    timeoutMs,
  });
  const detail = res.ok ? JSON.stringify(res.data) : res.error;
  console.log(
    `${stage.padEnd(6)} ${model}  ${res.ok ? 'ok  ' : 'FAIL'}  ${res.meta.latencyMs} ms  ${detail}`,
  );
  if (!res.ok) failed += 1;
}
process.exit(failed ? 1 : 0);
