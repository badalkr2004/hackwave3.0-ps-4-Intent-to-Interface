import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { Intent } from '@gestalt/shared';

export function Headline({ intent }: { intent: Pick<Intent, 'headline' | 'summary'> | null }) {
  const reduced = useReducedMotion() ?? false;
  const headline = intent?.headline ?? 'Gestalt';
  const summary = intent?.summary ?? 'Loading your workspace…';
  return (
    <div className="min-w-0">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={headline}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
          transition={{ duration: reduced ? 0.1 : 0.18 }}
        >
          <h1 tabIndex={-1} className="truncate text-2xl font-medium text-text">
            {headline}
          </h1>
          <p className="mt-1 text-sm text-muted">{summary}</p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
