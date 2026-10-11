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
  BETTER_AUTH_SECRET: z.string().min(16).optional(),
  // Public origin the browser uses (Vite in dev) so auth cookies stick on the proxied host.
  BETTER_AUTH_URL: z.string().url().default('http://localhost:5173'),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  /** Atlassian API token used when a user connects Jira without pasting their own token. */
  JIRA_API_KEY: z.string().optional(),
  /** Optional defaults pre-filled / used when connecting Jira. */
  JIRA_BASE_URL: z.string().url().optional(),
  JIRA_EMAIL: z.string().email().optional(),
  JIRA_PROJECT_KEY: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);
