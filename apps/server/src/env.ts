import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { z } from 'zod';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const envPath = resolve(repoRoot, '.env');
if (existsSync(envPath)) config({ path: envPath, quiet: true });

const flag = z
  .string()
  .optional()
  .transform((v) => v === '1' || v === 'true');

const EnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),
  DB_SCHEMA: z
    .string()
    .regex(/^[a-z_][a-z0-9_]*$/, 'DB_SCHEMA must be a simple lowercase identifier')
    .refine((s) => s !== 'public', 'DB_SCHEMA must be a dedicated schema, not "public"')
    .default('gestalt'),
  ALLOW_DB_RESET: flag,
  MODEL_FAST: z.string().default('anthropic:claude-haiku-5-5'),
  MODEL_WRITE: z.string().default('anthropic:claude-sonnet-5-5'),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  PORT: z.coerce.number().int().positive().default(8787),
  FORCE_FALLBACK: flag,
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);
