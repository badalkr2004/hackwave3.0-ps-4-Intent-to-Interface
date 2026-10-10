import { defineModule } from './types';
import { loadTasks, scopedTasks, type TaskRow } from './tasks';

/** The scope's project, or the project with the most overdue tasks. */
function pickProject(scoped: TaskRow[], projectId: string | null): string | null {
  if (projectId) return projectId;
  const counts = new Map<string, number>();
  for (const t of scoped)
    if (t.overdue_days > 0) counts.set(t.project_id, (counts.get(t.project_id) ?? 0) + 1);
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return best?.[0] ?? null;
}

export default defineModule({
  id: 'blocker_chain',
  async loader(ctx) {
    const scoped = scopedTasks(ctx, await loadTasks(ctx));
    const projectId = pickProject(scoped, ctx.scope.projectId);
    if (!projectId) return null;
    const tasks = scoped.filter((t) => t.project_id === projectId && t.status !== 'done');
    if (!tasks.some((t) => t.depends_on.length > 0)) return null;
    const ids = new Set(tasks.map((t) => t.id));
    return {
      projectName: tasks[0]!.project_name,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        ownerName: t.owner_name,
        due: t.due,
        overdueDays: t.overdue_days,
        // Completed dependencies no longer block anything.
        dependsOn: t.depends_on.filter((d) => ids.has(d)),
      })),
    };
  },
  signal: (p) => {
    const byId = new Map(p.tasks.map((t) => [t.id, t]));
    const stuck = p.tasks.some(
      (t) => t.dependsOn.length > 0 && t.dependsOn.some((d) => (byId.get(d)?.overdueDays ?? 0) > 0),
    );
    return stuck ? 1 : 0.4;
  },
  evidence: (p) => {
    const byId = new Map(p.tasks.map((t) => [t.id, t]));
    const root = p.tasks.find(
      (t) => t.overdueDays > 0 && p.tasks.some((o) => o.dependsOn.includes(t.id)),
    );
    if (!root) return [`${p.tasks.length} open tasks in ${p.projectName}`];
    const waiting = p.tasks
      .filter((t) => t.dependsOn.includes(root.id))
      .map((t) => byId.get(t.id)!.title);
    return [
      `"${root.title}" is ${root.overdueDays} days late${root.ownerName ? ` (${root.ownerName})` : ''}`,
      `${waiting.length} task${waiting.length === 1 ? '' : 's'} waiting on it`,
    ];
  },
});
