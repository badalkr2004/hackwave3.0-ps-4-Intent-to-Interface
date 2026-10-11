import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Check } from 'lucide-react';
import { ThemeToggle } from '../shell/ThemeToggle';
import './landing.css';

type Billing = 'monthly' | 'annual';

const PLANS = [
  {
    id: 'team',
    name: 'Team',
    price: { monthly: '$199', annual: '$159' },
    unit: 'per workspace / mo',
    blurb: 'Small teams that want one adaptive workspace without seat math.',
    cta: 'Start workspace',
    href: '/signup',
    featured: false,
    features: [
      'Up to 8 seats included',
      'Intent → auction → morph core',
      'Why lens receipts',
      'Pin / dismiss steering',
      'Email support',
    ],
  },
  {
    id: 'seat',
    name: 'Seat',
    price: { monthly: '$32', annual: '$26' },
    unit: 'per user / mo',
    blurb: 'Scale by headcount. Built for AM, CS, and ops pods that live in prep and triage.',
    cta: 'Choose seats',
    href: '/signup',
    featured: true,
    features: [
      'Everything in Team',
      '$20–40 / user band by volume',
      'Role-aware layouts',
      'Ghost previews & pivots',
      'Priority support',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: { monthly: 'Custom', annual: 'Custom' },
    unit: 'org contract',
    blurb: 'SSO, org connectors, and usage-based LLM pass-through for regulated stacks.',
    cta: 'Talk to us',
    href: 'mailto:hello@gestalt.work?subject=Gestalt%20Enterprise',
    featured: false,
    features: [
      'SSO / SAML (Okta, Google)',
      'Org-scoped connectors',
      'LLM usage pass-through',
      'RBAC + audit exports',
      'Dedicated success',
    ],
  },
] as const;

const ROLE_FITS = [
  {
    role: 'Account Manager',
    pack: 'AM pack',
    plan: 'Seat',
    line: 'Pre-meeting prep, usage drops, renewal talking points.',
  },
  {
    role: 'Eng / Triage lead',
    pack: 'Eng triage pack',
    plan: 'Seat',
    line: 'Overdue, blockers, workload — auction stays sticky on incidents.',
  },
  {
    role: 'CS / Ops manager',
    pack: 'Ops pack',
    plan: 'Seat → Enterprise',
    line: 'Portfolio overview plus connector depth across the book.',
  },
  {
    role: 'IT / Security buyer',
    pack: 'Platform',
    plan: 'Enterprise',
    line: 'SSO, org connectors, LLM spend controls, audit receipts.',
  },
] as const;

const EXPANSION = [
  {
    title: 'Connectors',
    body: 'CRM, Slack, Jira / Linear, calendar — normalized facts into the same auction.',
  },
  {
    title: 'AM pack',
    body: 'Meeting prep, usage signal, talking points, and draft email grounded in digest facts.',
  },
  {
    title: 'Eng triage pack',
    body: 'Overdue, blockers, capacity — layouts that morph when the incident pivots.',
  },
] as const;

export function PricingPage() {
  const reduce = useReducedMotion();
  const [billing, setBilling] = useState<Billing>('monthly');

  return (
    <div className="landing pricing min-h-screen">
      <header className="landing-nav sticky top-0 z-40">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <a href="/" className="font-display text-xl tracking-tight text-text">
            Gestalt
          </a>
          <nav className="hidden items-center gap-5 text-sm text-muted md:flex" aria-label="Marketing">
            <a href="/" className="transition-colors hover:text-text">
              Product
            </a>
            <a href="/pricing" className="text-text" aria-current="page">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <a href="/login" className="hidden text-sm text-muted transition-colors hover:text-text sm:inline">
              Sign in
            </a>
            <a href="/signup" className="landing-cta landing-cta-primary !min-h-9 !px-3.5 !text-sm">
              Get started
              <ArrowRight className="size-3.5" aria-hidden />
            </a>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden px-5 pb-14 pt-16 sm:px-8 sm:pb-20 sm:pt-24">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <motion.div
            className="absolute -left-20 top-10 size-[24rem] rounded-full bg-accent/10 blur-3xl"
            animate={reduce ? undefined : { x: [0, 18, 0], y: [0, 12, 0] }}
            transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -right-16 bottom-0 size-[18rem] rounded-full bg-accent/5 blur-3xl"
            animate={reduce ? undefined : { x: [0, -14, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <div className="relative mx-auto max-w-6xl">
          <p className="font-display text-[clamp(2.75rem,8vw,5.5rem)] leading-[0.95] tracking-tight">
            Gestalt
          </p>
          <h1 className="mt-6 max-w-xl font-display text-[clamp(1.5rem,3.5vw,2.25rem)] leading-tight tracking-tight text-muted">
            Pricing that follows how teams buy — workspace, seat, or enterprise.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-muted">
            Same adaptive engine everywhere. Pay for seats as you grow; unlock SSO and connectors when
            the org is ready.
          </p>

          <div
            className="pricing-billing mt-10 inline-flex items-center gap-1 p-1"
            role="group"
            aria-label="Billing period"
          >
            <button
              type="button"
              className={billing === 'monthly' ? 'is-active' : undefined}
              aria-pressed={billing === 'monthly'}
              onClick={() => setBilling('monthly')}
            >
              Monthly
            </button>
            <button
              type="button"
              className={billing === 'annual' ? 'is-active' : undefined}
              aria-pressed={billing === 'annual'}
              onClick={() => setBilling('annual')}
            >
              Annual
              <span className="pricing-save">save ~20%</span>
            </button>
          </div>
        </div>
      </section>

      <section className="border-t border-border/50 px-5 py-16 sm:px-8 sm:py-20" aria-label="Plans">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-3">
          {PLANS.map((plan, i) => (
            <motion.article
              key={plan.id}
              className={`pricing-plan ${plan.featured ? 'is-featured' : ''}`}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : 0.06 * i, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              {plan.featured && <p className="pricing-plan-badge">Most teams</p>}
              <h2 className="font-display text-2xl tracking-tight">{plan.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{plan.blurb}</p>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-display text-4xl tracking-tight tabular-nums">
                  {plan.price[billing]}
                </span>
                <span className="text-sm text-muted">{plan.unit}</span>
              </div>
              <ul className="mt-8 flex flex-col gap-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-sm leading-snug text-text">
                    <Check className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={plan.href}
                className={`landing-cta mt-10 w-full ${
                  plan.featured ? 'landing-cta-primary' : 'landing-cta-ghost'
                }`}
              >
                {plan.cta}
                <ArrowUpRight className="size-4" aria-hidden />
              </a>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="border-t border-border/50 px-5 py-16 sm:px-8 sm:py-20" aria-label="By role">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.5rem)] tracking-tight">
            Thin guide by enterprise role
          </h2>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-muted">
            Pick the plan your buyer owns. Add a role pack when the auction is sticky for that job.
          </p>
          <div className="mt-10 divide-y divide-border/70 border-y border-border/70">
            {ROLE_FITS.map((row) => (
              <div
                key={row.role}
                className="grid gap-2 py-5 sm:grid-cols-[10rem_8rem_9rem_1fr] sm:items-baseline sm:gap-6"
              >
                <p className="font-display text-lg tracking-tight">{row.role}</p>
                <p className="text-sm text-accent-text">{row.pack}</p>
                <p className="text-sm font-medium tabular-nums">{row.plan}</p>
                <p className="text-sm leading-relaxed text-muted">{row.line}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border/50 px-5 py-16 sm:px-8 sm:py-20" aria-label="Expansion">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.5rem)] tracking-tight">
            Expand when the registry sticks
          </h2>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-muted">
            Connectors and role packs layer on Seat or Enterprise — same auction, more facts and
            layouts.
          </p>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {EXPANSION.map((item) => (
              <div key={item.title}>
                <h3 className="font-display text-xl tracking-tight">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border/50 px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 className="max-w-2xl font-display text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.1] tracking-tight">
            Start with the workspace. Grow into seats and org controls.
          </h2>
          <div className="mt-10 flex flex-wrap gap-3">
            <a href="/signup" className="landing-cta landing-cta-primary">
              Create account
              <ArrowRight className="size-4" aria-hidden />
            </a>
            <a href="/app" className="landing-cta landing-cta-ghost">
              Open demo workspace
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <p className="font-display text-2xl tracking-tight">Gestalt</p>
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            Team workspace · per-seat SaaS · Enterprise SSO & connectors. Role packs when the job is
            clear.
          </p>
        </div>
      </footer>
    </div>
  );
}
