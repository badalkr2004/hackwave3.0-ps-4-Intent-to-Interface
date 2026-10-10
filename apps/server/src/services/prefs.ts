import { eq } from 'drizzle-orm';
import { userWorkspacePrefs } from '../db/auth-schema';
import { getDrizzle } from '../db/drizzle';

export interface WorkspacePrefs {
  pinned: string[];
  dismissed: string[];
}

const empty: WorkspacePrefs = { pinned: [], dismissed: [] };

export async function loadPrefs(userId: string): Promise<WorkspacePrefs> {
  const db = getDrizzle();
  if (!db) return empty;
  const [row] = await db
    .select()
    .from(userWorkspacePrefs)
    .where(eq(userWorkspacePrefs.userId, userId))
    .limit(1);
  if (!row) return empty;
  return {
    pinned: Array.isArray(row.pinned) ? row.pinned : [],
    dismissed: Array.isArray(row.dismissed) ? row.dismissed : [],
  };
}

export async function savePrefs(userId: string, prefs: WorkspacePrefs): Promise<void> {
  const db = getDrizzle();
  if (!db) return;
  await db
    .insert(userWorkspacePrefs)
    .values({
      userId,
      pinned: prefs.pinned,
      dismissed: prefs.dismissed,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userWorkspacePrefs.userId,
      set: {
        pinned: prefs.pinned,
        dismissed: prefs.dismissed,
        updatedAt: new Date(),
      },
    });
}
