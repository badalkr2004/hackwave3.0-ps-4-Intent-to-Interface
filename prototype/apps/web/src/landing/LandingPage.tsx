import { useEffect, useRef, useState } from 'react';
import {
  motion,
  useInView,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { ThemeToggle } from '../shell/ThemeToggle';
import './landing.css';

const INTENT = 'Prepare me for Acme tomorrow';

const QUESTIONS = [
  'What changed since we last spoke?',
  'Where is usage sliding?',
  'What should I say in the room?',
  'What is blocking the next step?',
];

const HUNT_SHARDS = [
  { title: 'Q3 Revenue', meta: '12 tabs open', x: '8%', y: '12%', rot: -6, w: '14rem' },
  { title: 'Slack · #acme', meta: '847 unread', x: '58%', y: '8%', rot: 4, w: '13rem' },
  { title: 'Jira board', meta: 'filter lost', x: '22%', y: '42%', rot: 3, w: '12.5rem' },
  { title: 'Usage CSV', meta: 'exported Tue', x: '62%', y: '48%', rot: -3, w: '11.5rem' },
  { title: 'CRM notes', meta: 'stale · 19d', x: '38%', y: '68%', rot: 5, w: '13.5rem' },
  { title: 'Calendar', meta: 'overlap · 2pm', x: '12%', y: '74%', rot: -2, w: '11rem' },
];

const COMPOSED = [
  {
    q: 'Who is Acme right now?',
    body: 'Series B · renewal in 6 weeks · champion left last month',
    zone: 'L',
  },
  {
    q: 'What should I walk in knowing?',
    body: 'Usage −18% MoM · two open escalations · last call: pricing fear',
    zone: 'C',
  },
  {
    q: 'What do I say first?',
    body: 'Acknowledge the drop · show the path · ask for the new owner',
    zone: 'R',
  },
];

const RECEIPTS = [
  { need: 'client_context', score: '0.94', kept: true },
  { need: 'usage_signal', score: '0.91', kept: true },
  { need: 'talking_points', score: '0.88', kept: true },
  { need: 'org_wide_okrs', score: '0.41', kept: false },
];

export function LandingPage() {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: rootRef, offset: ['start start', 'end end'] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.35 });
  const progressScale = useTransform(progress, [0, 1], [0, 1]);

  return (
    <div ref={rootRef} className="landing min-h-screen">
      {!reduce && (
        <motion.div className="landing-progress" style={{ scaleX: progressScale }} aria-hidden />
      )}

      <header className="landing-nav sticky top-0 z-40">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <a href="/" className="font-display text-xl tracking-tight text-text">
            Gestalt
          </a>
          <nav className="hidden items-center gap-5 text-sm text-muted md:flex" aria-label="Marketing">
            <a href="/" className="text-text" aria-current="page">
              Product
            </a>
            <a href="/pricing" className="transition-colors hover:text-text">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <a href="/login" className="hidden text-sm text-muted transition-colors hover:text-text sm:inline">
              Sign in
            </a>
            <a href="/app" className="landing-cta landing-cta-primary !min-h-9 !px-3.5 !text-sm">
              Open workspace
              <ArrowRight className="size-3.5" aria-hidden />
            </a>
          </div>
        </div>
      </header>

      <Hero reduce={!!reduce} />
      <ClearingTheater />
      <IntentChapter />
      <ComposeChapter />
      <TrustChapter />
      <CloseChapter />

      <footer className="border-t border-border/60 px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-display text-2xl tracking-tight">Gestalt</p>
            <a
              href="/pricing"
              className="mt-3 inline-block text-sm text-muted transition-colors hover:text-text"
            >
              Pricing
            </a>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            Intent in. Ranked needs. Deterministic layout. A workspace that clears itself around the
            question.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Hero({ reduce }: { reduce: boolean }) {
  return (
    <section className="relative flex min-h-[calc(100svh-3.5rem)] flex-col justify-end overflow-hidden px-5 pb-16 pt-20 sm:px-8 sm:pb-24 sm:pt-28">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <motion.div
          className="absolute -left-24 top-16 size-[28rem] rounded-full bg-accent/10 blur-3xl"
          animate={reduce ? undefined : { x: [0, 24, 0], y: [0, 16, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -right-16 bottom-10 size-[22rem] rounded-full bg-accent/5 blur-3xl"
          animate={reduce ? undefined : { x: [0, -20, 0], y: [0, -12, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-6xl">
        <motion.p
          className="font-display text-[clamp(4.5rem,18vw,11rem)] leading-[0.85] tracking-[-0.04em] text-text"
          initial={reduce ? false : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          Gestalt
        </motion.p>

        <motion.div
          className="landing-hero-rule mt-8"
          initial={reduce ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.35, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />

        <motion.h1
          className="mt-8 max-w-xl font-display text-[clamp(1.75rem,4vw,2.75rem)] font-medium leading-[1.15] tracking-tight"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          Stop hunting. Start answering.
        </motion.h1>

        <motion.p
          className="mt-5 max-w-md text-base leading-relaxed text-muted sm:text-lg"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.58, duration: 0.65 }}
        >
          A workspace that composes itself around the job you are doing right now.
        </motion.p>

        <motion.div
          className="mt-10 flex flex-wrap items-center gap-3"
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.55 }}
        >
          <a href="/app" className="landing-cta landing-cta-primary">
            Enter the workspace
            <ArrowRight className="size-4" aria-hidden />
          </a>
          <a href="#story" className="landing-cta landing-cta-ghost">
            Watch the problem clear
          </a>
        </motion.div>
      </div>
    </section>
  );
}

/** Tall scroll chapter: sticky stage where scatter dissolves into a composed desk. */
function ClearingTheater() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  });
  const smooth = useSpring(scrollYProgress, { stiffness: 90, damping: 28, mass: 0.4 });

  const copyOpacity = useTransform(smooth, [0, 0.18, 0.32], [1, 1, 0]);
  const copyY = useTransform(smooth, [0, 0.32], [0, -24]);
  const noiseOpacity = useTransform(smooth, [0.05, 0.28, 0.48], [1, 0.85, 0]);
  const clearOpacity = useTransform(smooth, [0.42, 0.58, 1], [0, 1, 1]);
  const clearY = useTransform(smooth, [0.42, 0.65], [40, 0]);
  const [label, setLabel] = useState('The hunt');

  useMotionValueEvent(smooth, 'change', (v) => {
    const next = v < 0.35 ? 'The hunt' : v < 0.55 ? 'Clearing…' : 'The desk';
    setLabel((prev) => (prev === next ? prev : next));
  });

  return (
    <section id="story" ref={ref} className="relative h-[280svh] border-t border-border/50">
      <div className="landing-stage px-5 sm:px-8">
        <div className="relative mx-auto h-full w-full max-w-6xl">
          <p className="absolute top-8 left-0 text-xs font-medium tracking-[0.18em] text-accent-text uppercase">
            {reduce ? 'The desk' : label}
          </p>

          <motion.div
            className="absolute inset-x-0 top-[18%] max-w-lg"
            style={{ opacity: reduce ? 0 : copyOpacity, y: reduce ? 0 : copyY }}
          >
            <h2 className="font-display text-3xl leading-tight tracking-tight sm:text-4xl">
              Fixed dashboards make people hunt.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted">
              Tabs, exports, stale boards — finding the facts often costs more than doing the work.
              Scroll to watch the noise give way.
            </p>
          </motion.div>

          <motion.div
            className="absolute inset-0 top-[38%]"
            style={{ opacity: reduce ? 0 : noiseOpacity }}
            aria-hidden={!!reduce}
          >
            {HUNT_SHARDS.map((shard, i) => (
              <TheaterShard key={shard.title} shard={shard} index={i} progress={smooth} />
            ))}
          </motion.div>

          <motion.div
            className="absolute inset-x-0 top-[22%] grid gap-3 md:grid-cols-3 md:gap-4"
            style={{
              opacity: reduce ? 1 : clearOpacity,
              y: reduce ? 0 : clearY,
            }}
          >
            <div className="md:col-span-3 mb-2 max-w-xl">
              <h2 className="font-display text-3xl leading-tight tracking-tight sm:text-4xl">
                Then the workspace settles.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted">
                One intent. Ranked questions. Panels that belong to the job — not a graveyard of
                widgets.
              </p>
            </div>
            {COMPOSED.map((panel) => (
              <article
                key={panel.q}
                className="landing-panel-mock rounded-md p-4 sm:p-5"
                data-accent="true"
              >
                <span className="font-mono text-[11px] tracking-wide text-muted">{panel.zone}</span>
                <h3 className="mt-3 font-display text-lg leading-snug tracking-tight sm:text-xl">
                  {panel.q}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{panel.body}</p>
              </article>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function TheaterShard({
  shard,
  index,
  progress,
}: {
  shard: (typeof HUNT_SHARDS)[number];
  index: number;
  progress: MotionValue<number>;
}) {
  const reduce = useReducedMotion();
  const y = useTransform(progress, [0, 0.5], [index * 6, -50 - index * 22]);
  const x = useTransform(progress, [0.2, 0.5], [0, index % 2 === 0 ? -48 : 56]);
  const opacity = useTransform(progress, [0.15, 0.35, 0.5], [0.9, 0.7, 0]);
  const rotate = useTransform(progress, [0, 0.5], [shard.rot, shard.rot + (index % 2 === 0 ? -8 : 10)]);

  return (
    <motion.div
      className="landing-shard is-noise absolute rounded-md px-4 py-3"
      style={{
        left: shard.x,
        top: shard.y,
        width: shard.w,
        y: reduce ? 0 : y,
        x: reduce ? 0 : x,
        opacity: reduce ? 0 : opacity,
        rotate: reduce ? shard.rot : rotate,
      }}
    >
      <p className="text-sm font-medium text-text">{shard.title}</p>
      <p className="mt-1 text-xs text-muted">{shard.meta}</p>
      <div className="mt-3 h-1.5 w-full overflow-hidden bg-surface-2">
        <div
          className="h-full bg-border-strong/70"
          style={{ width: `${35 + ((index * 17) % 50)}%` }}
        />
      </div>
    </motion.div>
  );
}

function IntentChapter() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { amount: 0.45, once: true });
  const reduce = useReducedMotion();
  const [typed, setTyped] = useState(reduce ? INTENT : '');
  const [phase, setPhase] = useState<'idle' | 'typing' | 'done'>(reduce ? 'done' : 'idle');

  useEffect(() => {
    if (!inView || reduce) return;
    setPhase('typing');
    setTyped('');
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTyped(INTENT.slice(0, i));
      if (i >= INTENT.length) {
        window.clearInterval(id);
        setPhase('done');
      }
    }, 38);
    return () => window.clearInterval(id);
  }, [inView, reduce]);

  return (
    <section ref={ref} className="relative border-t border-border/50 px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-medium tracking-[0.18em] text-accent-text uppercase">
          One clear ask
        </p>
        <h2 className="mt-4 max-w-2xl font-display text-3xl leading-tight tracking-tight sm:text-4xl">
          Say the job. Not the widgets.
        </h2>
        <p className="mt-5 max-w-lg text-base leading-relaxed text-muted">
          Gestalt reads intent as shape and scope — then ranks the questions the task must answer.
        </p>

        <div className="mt-12 border-b border-border-strong pb-4">
          <p className="text-xs tracking-wide text-muted uppercase">Intent</p>
          <p className="mt-3 font-display text-2xl tracking-tight sm:text-3xl" aria-live="polite">
            {typed}
            {phase !== 'done' && <span className="landing-intent-caret" aria-hidden />}
          </p>
        </div>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2">
          {QUESTIONS.map((q, i) => (
            <motion.li
              key={q}
              className="border-l-2 border-accent/40 pl-4"
              initial={reduce ? false : { opacity: 0, x: -12 }}
              animate={phase === 'done' ? { opacity: 1, x: 0 } : { opacity: 0.15, x: 0 }}
              transition={{ delay: reduce ? 0 : i * 0.12, duration: 0.45 }}
            >
              <p className="text-sm leading-snug text-text sm:text-base">{q}</p>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ComposeChapter() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { amount: 0.35, once: true });
  const reduce = useReducedMotion();

  return (
    <section ref={ref} className="relative border-t border-border/50 px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-xl">
          <p className="text-xs font-medium tracking-[0.18em] text-accent-text uppercase">
            Composition
          </p>
          <h2 className="mt-4 font-display text-3xl leading-tight tracking-tight sm:text-4xl">
            The desk clears around the questions.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted">
            Needs are ranked. A deterministic auction picks panels. Shared pieces morph in place —
            no blank reload, no scavenger hunt.
          </p>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {COMPOSED.map((panel, i) => (
            <motion.article
              key={panel.q}
              className="landing-panel-mock rounded-md p-5"
              data-accent="true"
              initial={reduce ? false : { opacity: 0, y: 36, scale: 0.97 }}
              animate={inView ? { opacity: 1, y: 0, scale: 1 } : undefined}
              transition={{
                delay: reduce ? 0 : 0.15 + i * 0.14,
                duration: 0.65,
                ease: [0.16, 1, 0.3, 1],
              }}
              whileHover={reduce ? undefined : { y: -3 }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] tracking-wide text-muted">{panel.zone}</span>
                <motion.span
                  className="size-1.5 rounded-full bg-accent"
                  animate={
                    reduce || !inView
                      ? undefined
                      : { scale: [1, 1.35, 1], opacity: [0.7, 1, 0.7] }
                  }
                  transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.3 }}
                />
              </div>
              <h3 className="mt-4 font-display text-xl leading-snug tracking-tight">{panel.q}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{panel.body}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrustChapter() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { amount: 0.4, once: true });
  const reduce = useReducedMotion();

  return (
    <section ref={ref} className="relative border-t border-border/50 px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:gap-20">
        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-accent-text uppercase">
            Why lens
          </p>
          <h2 className="mt-4 font-display text-3xl leading-tight tracking-tight sm:text-4xl">
            Trust the layout — see the receipts.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted">
            Not a story invented after the fact. Real bid scores, what made the cut, and what was
            left out so you can bring it back.
          </p>
        </div>

        <div className="landing-panel-mock rounded-md p-5 sm:p-6">
          <p className="text-xs tracking-wide text-muted uppercase">Auction receipts</p>
          <ul className="mt-4 space-y-0">
            {RECEIPTS.map((row, i) => (
              <motion.li
                key={row.need}
                className="landing-receipt flex items-center justify-between gap-4 py-3"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={inView ? { opacity: 1, y: 0 } : undefined}
                transition={{ delay: reduce ? 0 : 0.1 + i * 0.08 }}
              >
                <div>
                  <p className="font-mono text-13 text-text">{row.need}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {row.kept ? 'Kept in layout' : 'Left out — bring back'}
                  </p>
                </div>
                <span
                  className={
                    row.kept
                      ? 'font-mono text-sm text-accent-text'
                      : 'font-mono text-sm text-muted'
                  }
                >
                  {row.score}
                </span>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function CloseChapter() {
  return (
    <section className="relative border-t border-border/50 px-5 py-28 sm:px-8 sm:py-36">
      <div className="mx-auto max-w-6xl">
        <h2 className="max-w-2xl font-display text-[clamp(2rem,5vw,3.5rem)] leading-[1.1] tracking-tight">
          Your next hour should not start with a scavenger hunt.
        </h2>
        <p className="mt-6 max-w-md text-base leading-relaxed text-muted">
          Open Gestalt. Name the job. Watch the workspace settle around what matters.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <a href="/app" className="landing-cta landing-cta-primary">
            Open workspace
            <ArrowUpRight className="size-4" aria-hidden />
          </a>
          <a href="/signup" className="landing-cta landing-cta-ghost">
            Create account
          </a>
        </div>
      </div>
    </section>
  );
}
