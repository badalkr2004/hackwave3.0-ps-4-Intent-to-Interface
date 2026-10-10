import { env } from './env';
import { createApp } from './app';
import { log } from './log';
import { llmMode } from './routes/health';

const app = createApp();

app.listen(env.PORT, () => {
  log.info(`Gestalt server listening on http://localhost:${env.PORT}`);
  if (llmMode() === 'fallback') {
    log.warn(
      env.FORCE_FALLBACK
        ? 'FORCE_FALLBACK=1: LLM disabled, using fixtures and keyword fallback.'
        : 'No API key for the configured model provider(s): running in fallback mode.',
    );
  }
  if (!env.DATABASE_URL) log.warn('DATABASE_URL is not set: serving fixture data only.');
});
