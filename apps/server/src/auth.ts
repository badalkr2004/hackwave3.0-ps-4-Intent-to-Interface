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
