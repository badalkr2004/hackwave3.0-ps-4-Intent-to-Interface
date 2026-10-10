import type { ReactNode } from 'react';
import { AnimatePresence, LayoutGroup, useReducedMotion, type Transition } from 'framer-motion';
import type { Panel, Zone } from '@gestalt/shared';
import { PanelFrame } from './PanelFrame';

const ZONES: { zone: Zone; area: string; label?: string }[] = [
  { zone: 'left', area: '[grid-area:left]', label: 'Background' },
  { zone: 'center', area: '[grid-area:center]' },
  { zone: 'right', area: '[grid-area:right]', label: 'Next steps' },
];

const STAGGER_MS = 40;
const STAGGER_CAP = 8;

export interface ZoneGridProps {
  panels: Panel[];
  lensOn?: boolean;
  renderLens?: (panel: Panel) => ReactNode;
  onTogglePin?: (componentId: string, pinned: boolean) => void;
  onDismiss?: (componentId: string) => void;
}

export function ZoneGrid({
  panels,
  lensOn = false,
  renderLens,
  onTogglePin,
  onDismiss,
}: ZoneGridProps) {
  const reduced = useReducedMotion() ?? false;
  const layoutTransition: Transition = reduced
    ? { duration: 0 }
    : { type: 'spring', stiffness: 260, damping: 30 };

  const enterFor = (index: number) =>
    reduced
      ? {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: 0.12 },
        }
      : {
          initial: { opacity: 0, scale: 0.97 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, transition: { duration: 0.15 } },
          transition: {
            layout: layoutTransition,
            opacity: { duration: 0.2, delay: (Math.min(index, STAGGER_CAP) * STAGGER_MS) / 1000 },
            scale: { duration: 0.2, delay: (Math.min(index, STAGGER_CAP) * STAGGER_MS) / 1000 },
          },
        };

  return (
    <LayoutGroup>
      <div className="grid w-full min-w-0 grid-cols-1 gap-4 [grid-template-areas:'center'_'left'_'right'] min-[700px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] min-[700px]:[grid-template-areas:'center_left'_'center_right'] min-[1100px]:grid-cols-[minmax(0,3fr)_minmax(0,6fr)_minmax(0,3fr)] min-[1100px]:[grid-template-areas:'left_center_right']">
        {ZONES.map(({ zone, area, label }) => {
          const inZone = panels
            .filter((p) => p.zone === zone)
            .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
          const children = (
            <AnimatePresence mode="popLayout" initial={false}>
              {inZone.map((p, i) => (
                <PanelFrame
                  key={p.id}
                  panel={p}
                  lensOn={lensOn}
                  lensSlot={renderLens?.(p)}
                  onTogglePin={onTogglePin}
                  onDismiss={onDismiss}
                  layoutTransition={layoutTransition}
                  enter={enterFor(i)}
                />
              ))}
            </AnimatePresence>
          );
          const className = `${area} flex min-w-0 flex-col content-start gap-4`;
          return label ? (
            <aside key={zone} aria-label={label} className={className}>
              {children}
            </aside>
          ) : (
            <div key={zone} className={className}>
              {children}
            </div>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
