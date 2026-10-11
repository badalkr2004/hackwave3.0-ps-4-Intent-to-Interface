import { Mail, Megaphone, UserRoundPlus, Bell } from 'lucide-react';
import type { PanelProps } from '@gestalt/shared';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
import type { ActionItem } from '../panels/types';

const ICONS: Record<string, typeof Mail> = {
  draft_pre_meeting_email: Mail,
  draft_customer_update: Mail,
  notify_engineering: Megaphone,
  nudge_owner: Bell,
  reassign_task: UserRoundPlus,
  escalate: Megaphone,
  add_followup_task: Bell,
  reschedule_meeting: Bell,
};

export function ActionRail({
  actions,
  nextMoves,
  onRun,
}: {
  actions: PanelProps<'action_bar'>['actions'] | null | undefined;
  nextMoves: string[];
  onRun: (action: ActionItem) => void;
}) {
  const list: ActionItem[] = actions?.length ? actions : [];

  return (
    <aside className="flex h-full flex-col gap-4 rounded-lg border border-border bg-surface p-4">
      <div>
        <h2 className="text-13 font-medium tracking-wide text-muted uppercase">Next moves</h2>
        {nextMoves.length === 0 ? (
          <p className="mt-2 text-sm text-muted">You’re clear — no urgent moves.</p>
        ) : (
          <ol className="mt-2 flex flex-col gap-2">
            {nextMoves.map((move, i) => (
              <li key={move} className="flex gap-2 text-sm text-text">
                <span className="tabular text-muted">{i + 1}.</span>
                <span>{move}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <Separator />

      <div>
        <h2 className="text-13 font-medium tracking-wide text-muted uppercase">Actions</h2>
        <div className="mt-2 flex flex-col gap-2">
          {list.length === 0 ? (
            <p className="text-sm text-muted">Actions appear when this task can do work.</p>
          ) : (
            list.map((a) => {
              const Icon = ICONS[a.id] ?? Bell;
              return (
                <Button
                  key={a.id}
                  variant={a.kind === 'draft_email' ? 'default' : 'secondary'}
                  className="w-full justify-start"
                  onClick={() => onRun(a)}
                >
                  <Icon aria-hidden className="size-4" />
                  {a.label}
                </Button>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
