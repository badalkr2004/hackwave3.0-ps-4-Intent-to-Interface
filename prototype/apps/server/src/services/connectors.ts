import { eq } from 'drizzle-orm';
import { userWorkspacePrefs, type StoredConnectors } from '../db/auth-schema';
import { getDrizzle } from '../db/drizzle';
import { envJiraDefaults, resolveCredentials, tryEnvCredentials, verifyJira } from './jira';

export type PublicJiraConnector = {
  id: 'jira';
  connected: boolean;
  baseUrl?: string;
  email?: string;
  projectKey?: string;
  displayName?: string;
  connectedAt?: string;
  hasStoredToken: boolean;
  usingServerToken: boolean;
};

export type PublicConnectorCatalogItem = {
  id: 'jira';
  name: string;
  description: string;
  connected: boolean;
  available: boolean;
};

export async function loadStoredConnectors(userId: string): Promise<StoredConnectors> {
  const db = getDrizzle();
  if (!db) return {};
  const [row] = await db
    .select({ connectors: userWorkspacePrefs.connectors })
    .from(userWorkspacePrefs)
    .where(eq(userWorkspacePrefs.userId, userId))
    .limit(1);
  return row?.connectors ?? {};
}

async function saveStoredConnectors(userId: string, connectors: StoredConnectors): Promise<void> {
  const db = getDrizzle();
  if (!db) throw new Error('Database is not available.');
  await db
    .insert(userWorkspacePrefs)
    .values({
      userId,
      pinned: [],
      dismissed: [],
      connectors,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userWorkspacePrefs.userId,
      set: {
        connectors,
        updatedAt: new Date(),
      },
    });
}

export function toPublicJira(stored: StoredConnectors): PublicJiraConnector {
  const jira = stored.jira;
  const defaults = envJiraDefaults();
  if (!jira) {
    return {
      id: 'jira',
      connected: false,
      hasStoredToken: false,
      usingServerToken: defaults.hasServerToken,
    };
  }
  return {
    id: 'jira',
    connected: true,
    baseUrl: jira.baseUrl,
    email: jira.email,
    projectKey: jira.projectKey,
    displayName: jira.displayName,
    connectedAt: jira.connectedAt,
    hasStoredToken: Boolean(jira.apiToken),
    usingServerToken: !jira.apiToken && defaults.hasServerToken,
  };
}

export async function listConnectors(userId: string): Promise<{
  catalog: PublicConnectorCatalogItem[];
  jira: PublicJiraConnector;
  defaults: ReturnType<typeof envJiraDefaults>;
}> {
  const stored = await loadStoredConnectors(userId);
  const jira = toPublicJira(stored);
  const defaults = envJiraDefaults();
  return {
    defaults,
    jira,
    catalog: [
      {
        id: 'jira',
        name: 'Jira',
        description:
          'Pull recent tickets into Gestalt, create issues, and mark them done from the dashboard.',
        connected: jira.connected,
        available: true,
      },
    ],
  };
}

export async function connectJira(
  userId: string,
  input: {
    baseUrl: string;
    email: string;
    projectKey?: string;
    apiToken?: string;
  },
): Promise<PublicJiraConnector> {
  const creds = resolveCredentials({
    baseUrl: input.baseUrl,
    email: input.email,
    apiToken: input.apiToken,
  });
  const me = await verifyJira(creds);
  const stored = await loadStoredConnectors(userId);
  const next: StoredConnectors = {
    ...stored,
    jira: {
      baseUrl: creds.baseUrl,
      email: creds.email,
      projectKey: input.projectKey?.trim() || undefined,
      // Only persist a user-supplied token; otherwise keep using env.
      ...(input.apiToken?.trim() ? { apiToken: input.apiToken.trim() } : {}),
      displayName: me.displayName,
      connectedAt: new Date().toISOString(),
    },
  };
  await saveStoredConnectors(userId, next);
  return toPublicJira(next);
}

export async function disconnectJira(userId: string): Promise<PublicJiraConnector> {
  const stored = await loadStoredConnectors(userId);
  const { jira: _removed, ...rest } = stored;
  await saveStoredConnectors(userId, rest);
  return toPublicJira(rest);
}

export async function updateJiraSettings(
  userId: string,
  patch: { projectKey?: string | null },
): Promise<PublicJiraConnector> {
  const stored = await loadStoredConnectors(userId);
  if (!stored.jira) throw new Error('Jira is not connected.');
  const next: StoredConnectors = {
    ...stored,
    jira: {
      ...stored.jira,
      projectKey:
        patch.projectKey === null || patch.projectKey === ''
          ? undefined
          : patch.projectKey?.trim() || stored.jira.projectKey,
    },
  };
  await saveStoredConnectors(userId, next);
  return toPublicJira(next);
}

export async function jiraCredentialsForUser(userId: string) {
  const stored = await loadStoredConnectors(userId);
  if (!stored.jira) throw new Error('Connect Jira first from the Connectors page.');
  return {
    creds: resolveCredentials({
      baseUrl: stored.jira.baseUrl,
      email: stored.jira.email,
      apiToken: stored.jira.apiToken,
    }),
    projectKey: stored.jira.projectKey,
  };
}

/** User connection first, then complete server env defaults — used by the registry loader. */
export async function resolveJiraForSession(userId: string | null): Promise<{
  creds: ReturnType<typeof resolveCredentials>;
  projectKey?: string;
  displayName?: string;
  source: 'user' | 'env';
} | null> {
  if (userId) {
    const stored = await loadStoredConnectors(userId);
    if (stored.jira) {
      return {
        creds: resolveCredentials({
          baseUrl: stored.jira.baseUrl,
          email: stored.jira.email,
          apiToken: stored.jira.apiToken,
        }),
        projectKey: stored.jira.projectKey,
        displayName: stored.jira.displayName,
        source: 'user',
      };
    }
  }
  const fromEnv = tryEnvCredentials();
  if (!fromEnv) return null;
  return { ...fromEnv, source: 'env' };
}
