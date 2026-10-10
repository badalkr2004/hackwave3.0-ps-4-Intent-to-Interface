import { useEffect, useMemo } from 'react';
import { CircleAlert, LoaderCircle } from 'lucide-react';
import type { StatusStage } from '@gestalt/shared';
import { PanelActionsContext, type PanelActions } from './panels/types';
import { intentEditedSince, isTypingTarget } from './lib/typing';
import { DiffRibbon } from './shell/DiffRibbon';
import { GhostPreviews } from './shell/GhostPreviews';
import { HEADLINE_ID, INTENT_INPUT_ID, WHY_DRAWER_HEADING_ID, panelHeadingId } from './shell/ids';
import { EmailDialog } from './shell/EmailDialog';
import { Toast } from './shell/Toast';
import { Headline } from './shell/Headline';
import { IntentBar } from './shell/IntentBar';
import { StackChip } from './shell/StackChip';
import { WhyDrawer } from './shell/WhyDrawer';
import { WhyOverlay } from './shell/WhyOverlay';
import { WhyToggle } from './shell/WhyToggle';
import { ZoneGrid } from './shell/ZoneGrid';
import { useWorkspace } from './store/workspace';

const STAGE_TEXT: Record<StatusStage, string> = {
  parsing: 'Understanding your request…',
  fetching: 'Gathering data…',
  planning: 'Deciding what matters…',
  composing: 'Arranging the workspace…',
  writing: 'Writing the details…',
};

export function App() {
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

  // Focus the Left-out drawer only when the lens turns on, not on every recomposition.
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

  return (
    <PanelActionsContext.Provider value={actions}>
      <a
        href="#workspace"
        className="sr-only-focusable fixed top-4 left-4 z-50 rounded-md bg-surface px-4 py-2 text-sm text-text shadow-panel"
      >
        Skip to workspace
      </a>
      <header className="mx-auto flex max-w-[1400px] flex-col gap-4 px-5 pt-6 pb-4">
        <div className="flex flex-col gap-2">
          <StackChip previousHeadline={previousHeadline} onBack={() => void s.back()} />
          <Headline intent={s.spec?.intent ?? null} />
          {s.spec?.diff && <DiffRibbon key={`${s.spec.id}:${s.spec.version}`} spec={s.spec} />}
        </div>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <IntentBar
              busy={busy}
              showSuggestions={s.phase === 'idle'}
              demoPrompts={s.demoPrompts}
              onSubmit={(text) => void s.submit(text)}
              onHome={() => void s.home()}
            />
          </div>
          <WhyToggle on={s.lensOn} onToggle={s.toggleLens} />
        </div>
        <p className="min-h-5 text-xs text-muted" aria-hidden={!busy}>
          {busy && (
            <span className="inline-flex items-center gap-2">
              <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
              {s.stage ? STAGE_TEXT[s.stage] : 'Working…'}
            </span>
          )}
        </p>
      </header>

      <main id="workspace" className="mx-auto flex max-w-[1400px] flex-col gap-4 px-5 pb-6">
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
            <LoaderCircle aria-hidden className="size-4 animate-spin" /> Loading your workspace…
          </p>
        ) : (
          s.spec && (
            <>
              <ZoneGrid
                panels={s.spec.panels}
                lensOn={s.lensOn}
                renderLens={(panel) => {
                  const receipt = s.spec?.receipts.find((r) => r.panelId === panel.id);
                  return receipt && s.spec ? (
                    <WhyOverlay receipt={receipt} needs={s.spec.needs} />
                  ) : null;
                }}
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

      <footer className="mx-auto flex max-w-[1400px] flex-col gap-2 px-5 pb-6 text-xs text-muted">
        {s.actionsLog.length > 0 && (
          <section aria-labelledby="recent-actions-heading">
            <h2 id="recent-actions-heading" className="font-medium text-text">
              Recent actions
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
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>Gestalt</span>
          {s.degraded && <span>Some content used offline mode</span>}
          <a href="/gallery" className="text-accent-text underline">
            Component gallery
          </a>
        </div>
      </footer>

      <EmailDialog email={s.email} onClose={s.closeEmail} />
      <Toast toast={s.toast} onDone={s.clearToast} />

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {s.announcement}
      </div>
    </PanelActionsContext.Provider>
  );
}
