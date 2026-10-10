import { env } from './env';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;

function emit(level: Level, msg: string, fields?: Record<string, unknown>): void {
  if (LEVELS[level] < LEVELS[env.LOG_LEVEL]) return;
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${msg}`;
  const out = fields ? `${line} ${JSON.stringify(fields)}` : line;
  if (level === 'error' || level === 'warn') console.error(out);
  else console.log(out);
}

export const log = {
  debug: (msg: string, fields?: Record<string, unknown>) => emit('debug', msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => emit('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit('error', msg, fields),
};
