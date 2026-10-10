import cors from 'cors';
import express from 'express';
import type { ErrorRequestHandler } from 'express';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth';
import { env } from './env';
import { log } from './log';
import { actionsRouter } from './routes/actions';
import { healthRouter } from './routes/health';
import { meRouter } from './routes/me';
import { orgsRouter } from './routes/orgs';
import { sessionRouter } from './routes/session';

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(
    cors({
      origin: env.WEB_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  // Better Auth must see the raw body stream (Express 5 catch-all uses *splat).
  if (auth) {
    app.all('/api/auth/*splat', toNodeHandler(auth));
  }

  app.use(express.json({ limit: '500kb' }));

  app.use('/api', healthRouter);
  app.use('/api', meRouter);
  app.use('/api', orgsRouter);
  app.use('/api', sessionRouter);
  app.use('/api', actionsRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  const onError: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
    log.error('Unhandled request error', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Internal server error' });
  };
  app.use(onError);

  return app;
}
