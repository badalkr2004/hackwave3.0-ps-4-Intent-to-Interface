import { useContext } from 'react';
import {
  ArrowRightLeft,
  BellRing,
  CalendarClock,
  ListPlus,
  Mail,
  MessageSquareWarning,
  Send,
  Siren,
  type LucideIcon,
} from 'lucide-react';
import type { ActionId } from '@gestalt/shared';
import { PanelActionsContext, type PanelViewProps } from '../types';
import { EmptyState } from '../ui';

const ICONS: Record<ActionId, LucideIcon> = {
  draft_pre_meeting_email: Mail,
  add_followup_task: ListPlus,
  reschedule_meeting: CalendarClock,
  notify_engineering: MessageSquareWarning,
  draft_customer_update: Send,
  nudge_owner: BellRing,
  reassign_task: ArrowRightLeft,
  escalate: Siren,
};

export function ActionBar({ props, size }: PanelViewProps<'action_bar'>) {
  const { runAction } = useContext(PanelActionsContext);
  if (props.actions.length === 0) return <EmptyState message="No actions for this task." />;

  return (
    <ul className={`flex gap-2 ${size === 'S' ? 'flex-wrap' : 'flex-col'}`}>
      {props.actions.map((a, i) => {
        const Icon = ICONS[a.id];
        const primary = i === 0;
        return (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => runAction(a)}
              className={`inline-flex min-h-8 w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                primary
                  ? 'bg-accent text-surface hover:bg-accent-text'
                  : 'border border-border bg-surface text-text hover:bg-surface-2'
              }`}
            >
              <Icon aria-hidden className="size-4 shrink-0" />
              {a.label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
