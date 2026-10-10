import { clamp01, defineModule } from './types';
import { loadTasks, scopedTasks } from './tasks';

export default defineModule({
  id: 'overdue_queue',
  async loader(ctx) {
    const scoped = scopedTasks(ctx, await loadTasks(ctx));
    const overdue = scoped
      .filter((t) => t.overdue_days > 0)
      .sort((a, b) => b.overdue_days - a.overdue_days || a.id.localeCompare(b.id));
    const projectName = ctx.scope.projectId ? scoped[0]?.project_name : null;
    return {
      scopeLabel: projectName ?? (ctx.scope.clientId ? 'This client' : 'All projects'),
      overdueCount: overdue.length,
      tasks: overdue.map((t) => ({
        id: t.id,
        title: t.title,
        projectId: t.project_id,
        projectName: t.project_name,
        ownerId: t.owner_id,
        ownerName: t.owner_name,
        due: t.due,
        overdueDays: t.overdue_days,
        status: t.status,
      })),
    };
  },
  signal: (p) => clamp01(p.overdueCount / 4),
  evidence: (p) => {
    const worst = p.tasks[0];
    return [
      `${p.overdueCount} overdue task${p.overdueCount === 1 ? '' : 's'}`,
      ...(worst ? [`"${worst.title}" is ${worst.overdueDays} days late`] : []),
    ];
  },
});
