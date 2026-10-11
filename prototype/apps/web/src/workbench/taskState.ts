import { create } from 'zustand';

export type HypothesisVerdict = 'accepted' | 'rejected' | null;

interface TaskState {
  specId: string | null;
  checkedPoints: Record<string, boolean>;
  hypothesisVerdicts: Record<string, HypothesisVerdict>;
  snoozedTasks: Record<string, boolean>;
  clearedBlockers: Record<string, boolean>;
  resetForSpec: (specId: string) => void;
  togglePoint: (key: string) => void;
  setHypothesis: (key: string, verdict: HypothesisVerdict) => void;
  snoozeTask: (id: string) => void;
  clearBlocker: (id: string) => void;
}

export const useTaskState = create<TaskState>()((set, get) => ({
  specId: null,
  checkedPoints: {},
  hypothesisVerdicts: {},
  snoozedTasks: {},
  clearedBlockers: {},
  resetForSpec: (specId) => {
    if (get().specId === specId) return;
    set({
      specId,
      checkedPoints: {},
      hypothesisVerdicts: {},
      snoozedTasks: {},
      clearedBlockers: {},
    });
  },
  togglePoint: (key) =>
    set((s) => ({ checkedPoints: { ...s.checkedPoints, [key]: !s.checkedPoints[key] } })),
  setHypothesis: (key, verdict) =>
    set((s) => ({
      hypothesisVerdicts: {
        ...s.hypothesisVerdicts,
        [key]: s.hypothesisVerdicts[key] === verdict ? null : verdict,
      },
    })),
  snoozeTask: (id) => set((s) => ({ snoozedTasks: { ...s.snoozedTasks, [id]: true } })),
  clearBlocker: (id) => set((s) => ({ clearedBlockers: { ...s.clearedBlockers, [id]: true } })),
}));

export function computeReadiness(input: {
  shape: string;
  pointCount: number;
  checkedCount: number;
  hasAcceptedHypothesis: boolean;
  overdueRemaining: number;
  overdueTotal: number;
  gapCount: number;
}): number {
  const { shape, pointCount, checkedCount, hasAcceptedHypothesis, overdueRemaining, overdueTotal, gapCount } =
    input;

  if (shape === 'prepare') {
    const base = 28;
    const talk = pointCount ? (checkedCount / pointCount) * 55 : 20;
    const gapPenalty = Math.min(gapCount * 6, 24);
    return Math.round(Math.max(12, Math.min(96, base + talk - gapPenalty + (checkedCount > 0 ? 8 : 0))));
  }
  if (shape === 'diagnose') {
    return hasAcceptedHypothesis ? 82 : gapCount > 2 ? 34 : 48;
  }
  if (shape === 'triage') {
    if (!overdueTotal) return 90;
    const cleared = (overdueTotal - overdueRemaining) / overdueTotal;
    return Math.round(30 + cleared * 65);
  }
  return Math.max(20, 70 - gapCount * 10);
}
