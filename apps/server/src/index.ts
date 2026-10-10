import { env } from './env';
import { createApp } from './app';
import { initDatabase } from './db/init';
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
  void initDatabase();
});
