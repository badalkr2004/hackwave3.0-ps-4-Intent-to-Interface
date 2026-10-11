import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { z } from 'zod';

/** Load repo-root .env before any @gestalt/server imports (DATABASE_URL, etc.). */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const envPath = resolve(repoRoot, '.env');
if (existsSync(envPath)) config({ path: envPath, quiet: true });

const McpEnvSchema = z.object({
  /**
   * Personal access token from Gestalt → Connectors → IDE access (`gst_mcp_…`).
   * Identity + org are resolved from the token — do not put user ids in client config.
   */
  GESTALT_MCP_TOKEN: z
    .string()
    .min(16, 'GESTALT_MCP_TOKEN must be a Gestalt MCP PAT from Connectors → IDE access'),
});

export type McpEnv = z.infer<typeof McpEnvSchema>;

export function loadMcpEnv(): McpEnv {
  const parsed = McpEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    throw new Error(`MCP env invalid: ${msg}`);
  }
  return parsed.data;
}

export { repoRoot };
