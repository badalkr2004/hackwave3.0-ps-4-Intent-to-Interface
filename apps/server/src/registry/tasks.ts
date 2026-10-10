import type { TaskStatus } from '@gestalt/shared';
import { dayOf, type LoadContext } from './types';

export interface TaskRow {
  id: string;
  title: string;
  project_id: string;
  project_name: string;
  client_id: string | null;
  owner_id: string | null;
  owner_name: string | null;
  due: string;
  status: TaskStatus;
  depends_on: string[];
  overdue_days: number;
}

/** All tasks with project and owner names, memoized per load. `overdue_days` is 0 unless overdue. */
export function loadTasks(ctx: LoadContext): Promise<TaskRow[]> {
  return ctx.once('tasks', async () => {
    const { db } = ctx;
    const today = dayOf(ctx, 0);
    return db.sql<TaskRow[]>`
      SELECT t.id, t.title, t.project_id, p.name AS project_name, p.client_id,
        t.owner_id, o.name AS owner_name, to_char(t.due, 'YYYY-MM-DD') AS due, t.status,
        t.depends_on,
        CASE WHEN t.status <> 'done' AND t.due < ${today}::date
          THEN (${today}::date - t.due)::int ELSE 0 END AS overdue_days
      FROM ${db.table('tasks')} t
      JOIN ${db.table('projects')} p ON p.id = t.project_id
      LEFT JOIN ${db.table('people')} o ON o.id = t.owner_id
      ORDER BY t.due, t.id`;
  });
}

/** Tasks within the scope's project, else the scope's client, else everything. */
export function scopedTasks(ctx: LoadContext, tasks: TaskRow[]): TaskRow[] {
  const { projectId, clientId } = ctx.scope;
  if (projectId) return tasks.filter((t) => t.project_id === projectId);
  if (clientId) return tasks.filter((t) => t.client_id === clientId);
  return tasks;
}
