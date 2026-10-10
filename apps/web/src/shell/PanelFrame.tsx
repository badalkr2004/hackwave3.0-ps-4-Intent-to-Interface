import { forwardRef, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion, type TargetAndTransition, type Transition } from 'framer-motion';
import { Pin, PinOff, X } from 'lucide-react';
import type { Need, Panel, Receipt, Size } from '@gestalt/shared';
import { panelHeadingId } from './ids';
import { PanelBody } from './PanelBody';
import { WhyOverlay, WhyPopover } from './WhyOverlay';

/** FNV-1a; only needs to change when the content changes. */
function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const SIZE_CLASSES: Record<Size, string> = {
  S: 'min-h-[148px] max-h-[280px]',
  M: 'min-h-[248px] max-h-[480px]',
  L: 'min-h-[372px] max-h-[720px]',
};

export interface PanelFrameProps {
  panel: Panel;
  lensOn: boolean;
  receipt?: Receipt | null;
  needs?: Need[];
  /** @deprecated Prefer receipt + needs; kept for gallery stubs. */
  lensSlot?: ReactNode;
  onTogglePin?: (componentId: string, pinned: boolean) => void;
  onDismiss?: (componentId: string) => void;
  layoutTransition?: Transition;
  enter?: {
    initial: TargetAndTransition;
    animate: TargetAndTransition;
    exit: TargetAndTransition;
    transition: Transition;
  };
}

/** Makes the body a focusable region only when its content actually scrolls. */
function useScrollable<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [scrollable, setScrollable] = useState(false);
  const check = () => {
    const el = ref.current;
    if (el) setScrollable(el.scrollHeight > el.clientHeight + 1);
  };
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => check());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(check);
  return { ref, scrollable };
}

function IconButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      className={`inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text ${pressed ? 'bg-accent-bg text-accent-text' : ''}`}
    >
      {children}
    </button>
  );
}

export const PanelFrame = forwardRef<HTMLElement, PanelFrameProps>(function PanelFrame(
  {
    panel,
    lensOn,
    receipt,
    needs = [],
    lensSlot,
    onTogglePin,
    onDismiss,
    layoutTransition,
    enter,
  },
  ref,
) {
  const headingId = panelHeadingId(panel.id);
  const { ref: bodyRef, scrollable } = useScrollable<HTMLDivElement>();
  const reduced = useReducedMotion() ?? false;
  const contentKey = useMemo(
    () => hashString(JSON.stringify([panel.size, panel.status, panel.props])),
    [panel.size, panel.status, panel.props],
  );

  const whyStrip =
    lensOn && receipt ? (
      <WhyOverlay receipt={receipt} needs={needs} panelQuestion={panel.question} />
    ) : lensOn && lensSlot ? (
      lensSlot
    ) : null;

  return (
    <motion.section
      ref={ref}
      layout
      layoutId={panel.id}
      transition={layoutTransition}
      {...enter}
      aria-labelledby={headingId}
      aria-busy={panel.status === 'loading' || undefined}
      data-panel-id={panel.id}
      className={`flex flex-col overflow-hidden sheet ${panel.size === 'L' ? 'border-l-[3px] border-l-accent' : ''} ${SIZE_CLASSES[panel.size]}`}
    >
      <header className="flex items-start gap-2 px-4 pt-3">
        <div className="min-w-0 flex-1">
          <h2
            id={headingId}
            tabIndex={-1}
            className="font-display text-md leading-snug font-medium text-text"
          >
            {panel.question}
          </h2>
          {panel.pinned && <p className="mt-0.5 text-xs text-accent-text">Kept on screen</p>}
        </div>
        <div className="-mr-2 flex shrink-0 items-center">
          {receipt && !lensOn && (
            <WhyPopover receipt={receipt} needs={needs} panelQuestion={panel.question} />
          )}
          {onTogglePin && (
            <IconButton
              label={`${panel.pinned ? 'Stop keeping' : 'Keep'} ${panel.question}`}
              pressed={panel.pinned}
              onClick={() => onTogglePin(panel.componentId, !panel.pinned)}
            >
              {panel.pinned ? (
                <PinOff aria-hidden className="size-4" />
              ) : (
                <Pin aria-hidden className="size-4" />
              )}
            </IconButton>
          )}
          {onDismiss && (
            <IconButton
              label={`Hide ${panel.question}`}
              onClick={() => onDismiss(panel.componentId)}
            >
              <X aria-hidden className="size-4" />
            </IconButton>
          )}
        </div>
      </header>

      {whyStrip}

      <div
        ref={bodyRef}
        role={scrollable ? 'region' : undefined}
        aria-labelledby={scrollable ? headingId : undefined}
        tabIndex={scrollable ? 0 : undefined}
        className="min-h-0 flex-1 overflow-auto px-4 pt-2 pb-4"
      >
        <motion.div
          key={contentKey}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduced ? 0.12 : 0.2 }}
          className="h-full"
        >
          <PanelBody panel={panel} lens={lensOn} />
        </motion.div>
      </div>
    </motion.section>
  );
});
