import { useEffect, useMemo } from 'react';
import { CircleAlert, LoaderCircle } from 'lucide-react';
import type { StatusStage } from '@gestalt/shared';
import { AccessGate } from './auth/AccessGate';
import { PanelActionsContext, type PanelActions } from './panels/types';
import { intentEditedSince, isTypingTarget } from './lib/typing';
import { DiffRibbon } from './shell/DiffRibbon';
import { GhostPreviews } from './shell/GhostPreviews';
import { HEADLINE_ID, INTENT_INPUT_ID, WHY_DRAWER_HEADING_ID, panelHeadingId } from './shell/ids';
import { AuthMenu } from './shell/AuthMenu';
import { DegradedBanner } from './shell/DegradedBanner';
import { EmailDialog } from './shell/EmailDialog';
import { Toast } from './shell/Toast';
import { Headline } from './shell/Headline';
import { IntentBar } from './shell/IntentBar';
import { StackChip } from './shell/StackChip';
import { WhyDrawer } from './shell/WhyDrawer';
import { WhyToggle } from './shell/WhyToggle';
import { ZoneGrid } from './shell/ZoneGrid';
import { useWorkspace } from './store/workspace';
import type { OrgSummary } from './lib/orgApi';

const STAGE_COPY: Record<StatusStage, string> = {
  parsing: 'Reading your request…',
  fetching: 'Pulling in the facts…',
  planning: 'Picking what helps…',
  composing: 'Arranging workspace…',
  writing: 'Writing the notes…',
};

export function App() {
  return (
    <AccessGate>
      {(access) => (
        <WorkspaceApp
          activeOrg={access.status === 'ready' ? access.activeOrg : null}
          onAuthChange={() => window.location.assign('/login')}
        />
      )}
    </AccessGate>
  );
}

function WorkspaceApp({
  activeOrg,
  onAuthChange,
}: {
  activeOrg: OrgSummary | null;
  onAuthChange: () => void;
}) {
  const s = useWorkspace();
  const { init, runAction, toggleLens, cancelClarify } = s;

  useEffect(() => {
    void init();
  }, [init]);

  const focusRequest = s.focusRequest;
  useEffect(() => {
    if (!focusRequest) return;
    const input = document.getElementById(INTENT_INPUT_ID);
    if (focusRequest.target === 'headline') {
      if (document.activeElement === input && intentEditedSince(focusRequest.since)) return;
      document.getElementById(HEADLINE_ID)?.focus();
    } else if (focusRequest.target === 'panel') {
      (document.getElementById(panelHeadingId(focusRequest.panelId)) ?? input)?.focus();
    } else {
      input?.focus();
    }
  }, [focusRequest]);

  useEffect(() => {
    if (s.lensOn) document.getElementById(WHY_DRAWER_HEADING_ID)?.focus();
  }, [s.lensOn]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '?' && !isTypingTarget(e.target)) {
        e.preventDefault();
        toggleLens();
      }
      if (e.key === 'Escape') {
        if (s.clarification) {
          e.preventDefault();
          cancelClarify();
        } else if (s.lensOn) {
          e.preventDefault();
          toggleLens();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [s.clarification, s.lensOn, toggleLens, cancelClarify]);

  const actions: PanelActions = useMemo(() => ({ runAction }), [runAction]);
  const busy = s.phase === 'composing';
  const previousHeadline = s.history[s.history.length - 1] ?? null;
  const hasBrief = Boolean(s.spec?.intent);

  return (
    <PanelActionsContext.Provider value={actions}>
      <a
        href="#workspace"
        className="sr-only-focusable fixed top-4 left-4 z-50 rounded-md bg-surface px-4 py-2 text-sm text-text shadow-panel"
      >
        Skip to workspace
      </a>

      <div className="mx-auto flex min-h-screen max-w-[1280px] flex-col px-4 pt-5 pb-28 sm:px-6 sm:pb-10 lg:px-8">
        <header className="flex items-center justify-between gap-3 border-b border-border pb-4">
          <div className="min-w-0">
            <p className="font-display text-xl tracking-tight text-text sm:text-2xl">Gestalt</p>
            {activeOrg && (
              <p className="mt-0.5 truncate text-13 text-muted">{activeOrg.name}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <WhyToggle on={s.lensOn} onToggle={s.toggleLens} />
            <AuthMenu activeOrg={activeOrg} onAuthChange={onAuthChange} />
          </div>
        </header>

        <div className="mt-6 flex flex-col gap-3 sm:mt-8">
          <StackChip previousHeadline={previousHeadline} onBack={() => void s.back()} />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <Headline intent={s.spec?.intent ?? null} idle={!hasBrief && s.phase !== 'booting'} />
            {s.spec?.diff && (
              <DiffRibbon key={`${s.spec.id}:${s.spec.version}`} spec={s.spec} />
            )}
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface px-4 py-3 sm:static sm:z-0 sm:mt-5 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
          <IntentBar
            busy={busy}
            stageText={busy ? (s.stage ? STAGE_COPY[s.stage] : 'Arranging workspace…') : null}
            showSuggestions={
              s.phase === 'idle' && (!s.spec || s.spec.intent.shape === 'overview')
            }
            demoPrompts={s.demoPrompts}
            onSubmit={(text) => void s.submit(text)}
            onHome={() => void s.home()}
          />
        </div>

        <main id="workspace" className="mt-6 flex flex-1 flex-col gap-4 sm:mt-8">
          <DegradedBanner show={s.degraded} />
          {s.error && (
            <p
              role="alert"
              className="flex items-center gap-2 rounded-md bg-danger-bg p-3 text-sm text-danger"
            >
              <CircleAlert aria-hidden className="size-4 shrink-0" />
              {s.error}
            </p>
          )}
          {s.clarification ? (
            <GhostPreviews
              interpretations={s.clarification.interpretations}
              ghosts={s.clarification.ghosts}
              onPick={(id) => void s.resolve(id)}
              onCancel={s.cancelClarify}
            />
          ) : s.phase === 'booting' ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <LoaderCircle aria-hidden className="size-4 animate-spin" /> Opening your workspace…
            </p>
          ) : (
            s.spec && (
              <>
                <ZoneGrid
                  panels={s.spec.panels}
                  lensOn={s.lensOn}
                  receipts={s.spec.receipts}
                  needs={s.spec.needs}
                  onTogglePin={(id, pinned) => void s.pin(id, pinned)}
                  onDismiss={(id) => void s.dismiss(id)}
                />
                {s.lensOn && (
                  <WhyDrawer
                    spec={s.spec}
                    onClose={s.toggleLens}
                    onBringBack={(item) => void s.bringBack(item)}
                  />
                )}
              </>
            )
          )}
        </main>

        <footer className="mt-10 border-t border-border pt-4 text-xs text-muted">
          {s.actionsLog.length > 0 && (
            <section aria-labelledby="recent-actions-heading" className="mb-3">
              <h2 id="recent-actions-heading" className="font-medium text-text">
                Just now
              </h2>
              <ul className="mt-1 flex flex-col gap-0.5">
                {s.actionsLog
                  .slice(-3)
                  .reverse()
                  .map((a) => (
                    <li key={a.at}>{a.message}</li>
                  ))}
              </ul>
            </section>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <a href="/analytics" className="text-accent-text underline-offset-2 hover:underline">
              Analytics
            </a>
            <a href="/org" className="text-accent-text underline-offset-2 hover:underline">
              Organization
            </a>
            <a href="/gallery" className="text-accent-text underline-offset-2 hover:underline">
              Component gallery
            </a>
          </div>
        </footer>
      </div>

      <EmailDialog email={s.email} onClose={s.closeEmail} />
      <Toast toast={s.toast} onDone={s.clearToast} />

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {s.announcement}
      </div>
    </PanelActionsContext.Provider>
  );
}
