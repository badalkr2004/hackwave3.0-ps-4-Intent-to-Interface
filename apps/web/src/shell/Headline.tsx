import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { Intent } from '@gestalt/shared';
import { HEADLINE_ID } from './ids';

/** The `<h1>` stays mounted (it receives focus after recomposition); only its text swaps. */
export function Headline({ intent }: { intent: Pick<Intent, 'headline' | 'summary'> | null }) {
  const reduced = useReducedMotion() ?? false;
  const headline = intent?.headline ?? 'Gestalt';
  const summary = intent?.summary ?? 'Loading your workspace…';
  const swap = {
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 4 },
    animate: { opacity: 1, y: 0 },
    exit: reduced ? { opacity: 0 } : { opacity: 0, y: -4 },
    transition: { duration: reduced ? 0.1 : 0.18 },
  };
  return (
    <div className="min-w-0">
      <h1 id={HEADLINE_ID} tabIndex={-1} className="grid text-2xl font-medium text-text">
        <AnimatePresence initial={false}>
          <motion.span key={headline} {...swap} className="col-start-1 row-start-1 truncate">
            {headline}
          </motion.span>
        </AnimatePresence>
      </h1>
      <p className="mt-1 grid text-sm text-muted">
        <AnimatePresence initial={false}>
          <motion.span key={summary} {...swap} className="col-start-1 row-start-1">
            {summary}
          </motion.span>
        </AnimatePresence>
      </p>
    </div>
  );
}
