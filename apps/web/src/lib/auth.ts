import { createAuthClient } from 'better-auth/react';

/** Browser auth client; cookies go through the Vite `/api` proxy to the Express server. */
export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
});
