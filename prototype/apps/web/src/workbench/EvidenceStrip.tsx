import { MANIFESTS_BY_ID, type Panel } from '@gestalt/shared';
import { Badge } from '../components/ui/badge';
import { PanelBody } from '../shell/PanelBody';
import { cn } from '../lib/utils';

export function EvidenceStrip({
  panels,
  className,
}: {
  panels: Panel[];
  className?: string;
}) {
  if (!panels.length) return null;

  return (
    <section className={cn('flex flex-col gap-3', className)} aria-label="Supporting evidence">
      <div className="flex items-center gap-2">
        <h2 className="text-13 font-medium tracking-wide text-muted uppercase">Evidence</h2>
        <Badge>{panels.length}</Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {panels.map((panel) => {
          const title = MANIFESTS_BY_ID[panel.componentId]?.title ?? panel.componentId;
          return (
            <article
              key={panel.id}
              className="flex max-h-64 flex-col overflow-hidden rounded-lg border border-border bg-surface"
            >
              <header className="border-b border-border px-3 py-2">
                <h3 className="text-sm font-medium text-text">{title}</h3>
              </header>
              <div className="panel-scroll min-h-0 flex-1 p-3">
                <PanelBody panel={panel} lens={false} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
