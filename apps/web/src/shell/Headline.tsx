import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { Intent } from '@gestalt/shared';
import { HEADLINE_ID } from './ids';

/** The `<h1>` stays mounted (it receives focus after recomposition); only its text swaps. */
export function Headline({
  intent,
  idle = false,
}: {
  intent: Pick<Intent, 'headline' | 'summary'> | null;
  idle?: boolean;
}) {
  const reduced = useReducedMotion() ?? false;
  const headline = intent?.headline ?? (idle ? 'What are you working on?' : 'Gestalt');
  const summary =
    intent?.summary ??
    (idle
      ? 'Tell Gestalt the job in front of you. It gathers the right notes and puts them where you need them.'
      : 'Opening your workspace…');
  const swap = {
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: reduced ? { opacity: 0 } : { opacity: 0, y: -6 },
    transition: { duration: reduced ? 0.1 : 0.2 },
  };
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium tracking-[0.08em] text-muted uppercase">Now</p>
      <h1
        id={HEADLINE_ID}
        tabIndex={-1}
        className="mt-1 grid font-display text-2xl leading-tight text-text sm:text-[2.125rem]"
      >
        <AnimatePresence initial={false}>
          <motion.span key={headline} {...swap} className="col-start-1 row-start-1">
            {headline}
          </motion.span>
        </AnimatePresence>
      </h1>
      <p className="mt-2 grid max-w-2xl text-sm leading-relaxed text-muted sm:text-md">
        <AnimatePresence initial={false}>
          <motion.span key={summary} {...swap} className="col-start-1 row-start-1">
            {summary}
          </motion.span>
        </AnimatePresence>
      </p>
    </div>
  );
}
