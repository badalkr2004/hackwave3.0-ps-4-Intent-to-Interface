import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import * as schema from './db/auth-schema';
import { getDrizzle } from './db/drizzle';
import { env } from './env';
import { log } from './log';

function createAuth() {
  const db = getDrizzle();
  if (!db || !env.BETTER_AUTH_SECRET) {
    log.warn('Auth disabled: need DATABASE_URL and BETTER_AUTH_SECRET.');
    return null;
  }

  const socialProviders =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            // Better Auth reads `scope` (singular). Calendar + Drive for Meet.
            scope: [
              'https://www.googleapis.com/auth/calendar',
              'https://www.googleapis.com/auth/drive.readonly',
              'https://www.googleapis.com/auth/userinfo.email',
              'https://www.googleapis.com/auth/userinfo.profile',
            ],
            accessType: 'offline' as const,
            prompt: 'consent' as const,
          },
        }
      : undefined;

  if (socialProviders) log.info('Google OAuth enabled for Better Auth (Calendar + Drive scopes).');

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [env.WEB_ORIGIN],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },
    socialProviders,
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ['google'],
        // Connect Google is for Calendar/Meet tokens — the Google identity may
        // differ from the Gestalt login email (common in demos / work accounts).
        allowDifferentEmails: true,
        // Email/password demo users are often unverified; without this, OAuth
        // sign-in matching that email returns account_not_linked.
        requireLocalEmailVerified: false,
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    advanced: {
      // Cookie works across Vite (:5173) → API (:8787) via the proxy when same-site.
      defaultCookieAttributes: {
        sameSite: 'lax',
        secure: env.BETTER_AUTH_URL.startsWith('https'),
      },
    },
  });
}

export const auth = createAuth();
export type Auth = NonNullable<typeof auth>;
