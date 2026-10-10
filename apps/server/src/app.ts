import cors from 'cors';
import express from 'express';
import type { ErrorRequestHandler } from 'express';
import { log } from './log';
import { healthRouter } from './routes/health';

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', healthRouter);

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
