import type { ActionId, PanelProps, Shape } from '@gestalt/shared';
import { defineModule } from './types';

type Action = PanelProps<'action_bar'>['actions'][number];

const SHAPE_ACTIONS: Record<Shape, ActionId[]> = {
  overview: ['add_followup_task'],
  prepare: ['draft_pre_meeting_email', 'add_followup_task', 'reschedule_meeting'],
  diagnose: ['notify_engineering', 'draft_customer_update'],
  triage: ['nudge_owner', 'reassign_task', 'escalate'],
};

export default defineModule({
  id: 'action_bar',
  // Loads every action the scope supports; forShape picks the ones that fit the task.
  async loader(ctx) {
    const [meetings, overdue, workload] = await Promise.all([
      ctx.load('upcoming_meetings'),
      ctx.load('overdue_queue'),
      ctx.load('workload_bars'),
    ]);
    const clientId = ctx.scope.clientId;
    const meeting = meetings?.meetings[0];
    const late = overdue?.tasks[0];
    const lightest = [...(workload?.people ?? [])]
      .filter((p) => p.name !== late?.ownerName)
      .sort((a, b) => a.capacityPct - b.capacityPct)[0];

    const actions: Action[] = [];
    if (clientId && meeting) {
      actions.push({
        id: 'draft_pre_meeting_email',
        label: 'Draft pre-meeting email',
        kind: 'draft_email',
        params: { meetingId: meeting.id },
      });
    }
    actions.push({ id: 'add_followup_task', label: 'Add follow-up task', kind: 'mock' });
    if (meeting) {
      actions.push({
        id: 'reschedule_meeting',
        label: 'Reschedule meeting',
        kind: 'mock',
        params: { meetingId: meeting.id },
      });
    }
    actions.push({ id: 'notify_engineering', label: 'Notify engineering owner', kind: 'mock' });
    if (clientId) {
      actions.push({
        id: 'draft_customer_update',
        label: 'Draft customer update',
        kind: 'draft_email',
      });
    }
    if (late?.ownerName) {
      actions.push({
        id: 'nudge_owner',
        label: 'Nudge owner',
        kind: 'mock',
        params: { owner: late.ownerName, task: late.id },
      });
      if (lightest) {
        actions.push({
          id: 'reassign_task',
          label: 'Reassign task',
          kind: 'mock',
          params: { task: late.id, person: lightest.name },
        });
      }
    }
    if (overdue?.overdueCount) actions.push({ id: 'escalate', label: 'Escalate', kind: 'mock' });
    return { actions };
  },
  // SPEC-NOTE: Section 6.1 gives action_bar signal 0.6, but Section 8.2 expects size M in diagnose,
  // which needs score >= 0.5; with priority 0.7 and fit 1.0 that requires signal >= 0.8.
  signal: () => 0.8,
  evidence: (p) => [`${p.actions.length} next steps available`],
  forShape: (p, shape) => {
    const allowed = SHAPE_ACTIONS[shape];
    return {
      actions: p.actions
        .filter((a) => allowed.includes(a.id))
        .sort((a, b) => allowed.indexOf(a.id) - allowed.indexOf(b.id)),
    };
  },
});
