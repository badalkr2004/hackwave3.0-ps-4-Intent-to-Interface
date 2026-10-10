import type { Request } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth';

/** Signed-in Better Auth user for this request, or null. */
export async function requestUser(req: Request) {
  if (!auth) return null;
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  return session?.user ?? null;
}
