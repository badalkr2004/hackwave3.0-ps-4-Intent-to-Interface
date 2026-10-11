import { and, eq } from 'drizzle-orm';
import { google } from 'googleapis';
import { account, user } from '../db/auth-schema';
import { getDrizzle } from '../db/drizzle';
import { env } from '../env';

export const GOOGLE_MEET_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/drive.readonly',
] as const;

export function googleOAuthConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

function hasRequiredScopes(scope: string | null | undefined): boolean {
  if (!scope) return false;
  const parts = scope.split(/[\s,]+/).filter(Boolean);
  return GOOGLE_MEET_SCOPES.every((needed) => parts.includes(needed));
}

export type GoogleAccountRow = {
  id: string;
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: Date | null;
  scope: string | null;
  email: string | null;
};

export async function loadGoogleAccount(userId: string): Promise<GoogleAccountRow | null> {
  const db = getDrizzle();
  if (!db) return null;
  const [row] = await db
    .select({
      id: account.id,
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
      accessTokenExpiresAt: account.accessTokenExpiresAt,
      scope: account.scope,
      email: user.email,
    })
    .from(account)
    .innerJoin(user, eq(user.id, account.userId))
    .where(and(eq(account.userId, userId), eq(account.providerId, 'google')))
    .limit(1);
  return row ?? null;
}

export async function googleMeetConnected(userId: string): Promise<{
  connected: boolean;
  email?: string;
  scopes?: string;
  oauthConfigured: boolean;
  missingScopes: boolean;
}> {
  const oauthConfigured = googleOAuthConfigured();
  if (!oauthConfigured) {
    return { connected: false, oauthConfigured: false, missingScopes: false };
  }
  const acc = await loadGoogleAccount(userId);
  if (!acc?.refreshToken && !acc?.accessToken) {
    return { connected: false, oauthConfigured: true, missingScopes: false };
  }
  const ok = hasRequiredScopes(acc.scope);
  return {
    connected: ok,
    email: acc.email ?? undefined,
    scopes: acc.scope ?? undefined,
    oauthConfigured: true,
    missingScopes: !ok,
  };
}

/** OAuth2 client with a fresh access token for Calendar / Drive calls. */
export async function getGoogleOAuthClient(userId: string) {
  if (!googleOAuthConfigured()) {
    throw new Error('Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
  }
  const acc = await loadGoogleAccount(userId);
  if (!acc) {
    throw new Error('Connect Google from the Connectors page (sign in with Google and grant Calendar + Drive).');
  }
  if (!hasRequiredScopes(acc.scope)) {
    throw new Error(
      'Google is linked but missing Calendar/Drive permissions. Disconnect and Connect Google again to grant scopes.',
    );
  }
  if (!acc.refreshToken && !acc.accessToken) {
    throw new Error('Google account has no usable token. Connect Google again.');
  }

  const oauth2 = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
  oauth2.setCredentials({
    access_token: acc.accessToken ?? undefined,
    refresh_token: acc.refreshToken ?? undefined,
    expiry_date: acc.accessTokenExpiresAt?.getTime(),
  });

  const exp = acc.accessTokenExpiresAt?.getTime() ?? 0;
  const needsRefresh = !acc.accessToken || exp < Date.now() + 60_000;
  if (needsRefresh && acc.refreshToken) {
    const { credentials } = await oauth2.refreshAccessToken();
    oauth2.setCredentials(credentials);
    const db = getDrizzle();
    if (db && credentials.access_token) {
      await db
        .update(account)
        .set({
          accessToken: credentials.access_token,
          accessTokenExpiresAt: credentials.expiry_date
            ? new Date(credentials.expiry_date)
            : null,
          ...(credentials.refresh_token ? { refreshToken: credentials.refresh_token } : {}),
          updatedAt: new Date(),
        })
        .where(eq(account.id, acc.id));
    }
  }

  return oauth2;
}
