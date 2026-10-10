import { clamp01, defineModule } from './types';
import { loadTasks, scopedTasks } from './tasks';

export default defineModule({
  id: 'workload_bars',
  async loader(ctx) {
    const { db } = ctx;
    const [people, tasks] = await Promise.all([
      db.sql<{ id: string; name: string; role: string; capacity_pct: number }[]>`
        SELECT id, name, role, capacity_pct FROM ${db.table('people')} ORDER BY id`,
      loadTasks(ctx),
    ]);
    const open = scopedTasks(ctx, tasks).filter((t) => t.status !== 'done');
    const rows = people
      .map((p) => {
        const mine = open.filter((t) => t.owner_id === p.id);
        return {
          id: p.id,
          name: p.name,
          role: p.role,
          capacityPct: p.capacity_pct,
          openTasks: mine.length,
          overdueTasks: mine.filter((t) => t.overdue_days > 0).length,
        };
      })
      .filter((p) => p.openTasks > 0)
      .sort((a, b) => b.capacityPct - a.capacityPct || a.id.localeCompare(b.id));
    return rows.length ? { people: rows } : null;
  },
  signal: (p) => clamp01((Math.max(...p.people.map((x) => x.capacityPct)) - 100) / 80),
  evidence: (p) => {
    const top = p.people[0];
    if (!top) return [];
    return [
      `${top.name} is at ${top.capacityPct}% capacity with ${top.openTasks} open tasks`,
      ...(top.overdueTasks ? [`${top.overdueTasks} of ${top.name}'s tasks are overdue`] : []),
    ];
  },
});
