import { create } from 'zustand';
import {
  MANIFESTS_BY_ID,
  MAX_STACK_DEPTH,
  type ClientRef,
  type Exclusion,
  type GhostLayout,
  type Interpretation,
  type ProjectRef,
  type SseEvent,
  type StatusStage,
  type UISpec,
} from '@gestalt/shared';
import * as api from '../lib/api';
import { postStream } from '../lib/sse';
import type { ActionItem } from '../panels/types';

export type Phase = 'booting' | 'idle' | 'clarifying' | 'composing' | 'error';

export interface WorkspaceState {
  phase: Phase;
  sessionId: string | null;
  clients: ClientRef[];
  projects: ProjectRef[];
  demoPrompts: string[];
  stage: StatusStage | null;
  requestId: string | null;
  spec: UISpec | null;
  /** Headlines of earlier compositions, newest last (mirrors the server stack). */
  history: string[];
  clarification: { interpretations: Interpretation[]; ghosts: Record<string, GhostLayout> } | null;
  degraded: boolean;
  announcement: string;
  actionsLog: { at: number; message: string }[];
  toast: { id: number; message: string } | null;
  email: EmailDraftState | null;
  focusRequest: FocusRequest | null;
  lensOn: boolean;
  error: string | null;

  init: () => Promise<void>;
  submit: (text: string) => Promise<void>;
  resolve: (interpretationId: string) => Promise<void>;
  back: () => Promise<void>;
  home: () => Promise<void>;
  pin: (componentId: string, pinned: boolean) => Promise<void>;
  dismiss: (componentId: string) => Promise<void>;
  runAction: (action: ActionItem) => Promise<void>;
  closeEmail: () => void;
  clearToast: (id: number) => void;
  toggleLens: () => void;
  cancelClarify: () => void;
  bringBack: (item: Exclusion) => Promise<void>;
}

export type EmailDraftState =
  | { status: 'loading'; title: string }
  | { status: 'ready'; title: string; subject: string; body: string }
  | { status: 'error'; title: string; error: string };

/**
 * Where focus should go after the next render (Section 14.4). `since` is when the triggering
 * request started; typing in the intent bar after that keeps focus there.
 */
export type FocusTarget =
  { target: 'headline' } | { target: 'panel'; panelId: string } | { target: 'intent' };
export type FocusRequest = FocusTarget & { seq: number; since: number };

const ZONE_ORDER = { left: 0, center: 1, right: 2 } as const;

/** Panel ids in DOM reading order: left rail, center, right rail. */
function readingOrder(spec: UISpec | null): string[] {
  if (!spec) return [];
  return [...spec.panels]
    .sort(
      (a, b) =>
        ZONE_ORDER[a.zone] - ZONE_ORDER[b.zone] || a.order - b.order || a.id.localeCompare(b.id),
    )
    .map((p) => p.id);
}

let focusSeq = 0;
let inflight: AbortController | null = null;
let requestSeq = 0;

const nextRequestId = () => `r${Date.now().toString(36)}-${++requestSeq}`;

function rearrangedText(spec: UISpec): string {
  const n = spec.panels.length;
  if (!spec.diff) return `Workspace ready for ${spec.intent.headline}. ${n} panels.`;
  return `Workspace rearranged for ${spec.intent.headline}. ${n} panels: ${spec.diff.added.length} added, ${spec.diff.removed.length} removed.`;
}

function deferredReadyText(spec: UISpec): string {
  const titles = spec.panels
    .filter((p) => MANIFESTS_BY_ID[p.componentId]?.deferred)
    .map((p) => MANIFESTS_BY_ID[p.componentId]!.title);
  return titles.length ? `${titles.join(' and ')} ready` : '';
}

export const useWorkspace = create<WorkspaceState>()((set, get) => {
  const fail = (err: unknown) =>
    set({
      phase: 'error',
      stage: null,
      error: err instanceof Error ? err.message : 'Something went wrong',
    });

  /**
   * Shows a composition, mirroring the server stack: new compositions push the previous one onto
   * the history; pin and dismiss replace the current one in place.
   */
  const showSpec = (spec: UISpec, mode: 'push' | 'replace' = 'push') => {
    const { spec: prev, history } = get();
    const nextHistory =
      prev && mode === 'push'
        ? [...history, prev.intent.headline].slice(-MAX_STACK_DEPTH)
        : history;
    set({
      spec,
      history: nextHistory,
      degraded: spec.degraded,
      clarification: null,
      announcement: rearrangedText(spec),
    });
  };

  const requestFocus = (t: FocusTarget, since = performance.now()) =>
    set({ focusRequest: { ...t, seq: ++focusSeq, since } });

  let streamStartedAt = 0;

  const onEvent = (event: SseEvent) => {
    switch (event.type) {
      case 'status':
        set({ stage: event.stage });
        break;
      case 'intent':
        break;
      case 'clarify':
        set({
          phase: 'clarifying',
          clarification: { interpretations: event.interpretations, ghosts: event.ghosts },
          announcement: `Did you mean: ${event.interpretations.map((i) => i.label).join(', or ')}?`,
        });
        break;
      case 'spec':
        showSpec(event.spec);
        requestFocus({ target: 'headline' }, streamStartedAt);
        break;
      case 'patch': {
        const spec = get().spec;
        if (!spec) break;
        const panels = spec.panels.map((p) =>
          p.id === event.panelId ? { ...p, status: event.status, props: event.props } : p,
        );
        const next = { ...spec, panels };
        const done = !panels.some((p) => p.status === 'loading');
        set({ spec: next, ...(done ? { announcement: deferredReadyText(next) } : {}) });
        break;
      }
      case 'done':
        set({
          phase: get().clarification ? 'clarifying' : 'idle',
          stage: null,
          degraded: get().degraded || event.degraded,
        });
        break;
      case 'error':
        set({ phase: 'error', stage: null, error: event.message });
        break;
    }
  };

  const stream = async (action: 'compose' | 'resolve', body: Record<string, unknown>) => {
    const sessionId = get().sessionId;
    if (!sessionId) return;
    inflight?.abort();
    const ctrl = new AbortController();
    inflight = ctrl;
    const requestId = nextRequestId();
    streamStartedAt = performance.now();
    set({ phase: 'composing', stage: null, requestId, error: null });
    try {
      await postStream(
        api.sessionUrl(sessionId, action),
        { ...body, requestId },
        { signal: ctrl.signal, onEvent, isCurrent: () => get().requestId === requestId },
      );
      if (get().requestId === requestId && get().phase === 'composing')
        set({ phase: 'idle', stage: null });
    } catch (err) {
      if (ctrl.signal.aborted || get().requestId !== requestId) return;
      fail(err);
    }
  };

  /** Runs a non-streaming session call; a newer request (stream or call) supersedes it. */
  const call = async (
    fn: (sessionId: string) => Promise<UISpec>,
    after?: (spec: UISpec) => void,
  ) => {
    const sessionId = get().sessionId;
    if (!sessionId) return;
    inflight?.abort();
    const requestId = nextRequestId();
    set({ requestId });
    const isCurrent = () => get().requestId === requestId;
    try {
      const spec = await fn(sessionId);
      if (!isCurrent()) return;
      set({ phase: 'idle', stage: null, error: null });
      if (after) after(spec);
      else showSpec(spec);
    } catch (err) {
      if (isCurrent()) fail(err);
    }
  };

  return {
    phase: 'booting',
    sessionId: null,
    clients: [],
    projects: [],
    demoPrompts: [],
    stage: null,
    requestId: null,
    spec: null,
    history: [],
    clarification: null,
    degraded: false,
    announcement: '',
    actionsLog: [],
    toast: null,
    email: null,
    focusRequest: null,
    lensOn: false,
    error: null,

    async init() {
      try {
        const s = await api.createSession();
        set({
          phase: 'idle',
          sessionId: s.sessionId,
          clients: s.entities.clients,
          projects: s.entities.projects,
          demoPrompts: s.demoPrompts,
          spec: s.spec,
          degraded: s.spec.degraded,
          announcement: rearrangedText(s.spec),
        });
      } catch (err) {
        fail(err);
      }
    },

    submit: (text) => stream('compose', { text }),
    resolve: (interpretationId) => stream('resolve', { interpretationId }),

    back: () =>
      call(api.goBack, (spec) => {
        set((s) => ({
          spec,
          history: s.history.slice(0, -1),
          clarification: null,
          degraded: spec.degraded,
          announcement: `Back to ${spec.intent.headline}.`,
        }));
        requestFocus({ target: 'headline' });
      }),
    home: () =>
      call(api.goHome, (spec) => {
        showSpec(spec);
        requestFocus({ target: 'headline' });
      }),
    pin: (componentId, pinned) =>
      call(
        (id) => api.setPinned(id, componentId, pinned),
        (spec) => showSpec(spec, 'replace'),
      ),
    dismiss: (componentId) => {
      const before = readingOrder(get().spec);
      return call(
        (id) => api.dismissPanel(id, componentId),
        (spec) => {
          showSpec(spec, 'replace');
          const present = new Set(spec.panels.map((p) => p.id));
          const i = before.indexOf(componentId);
          const next = [...before.slice(i + 1), ...before.slice(0, Math.max(i, 0)).reverse()].find(
            (id) => present.has(id),
          );
          requestFocus(next ? { target: 'panel', panelId: next } : { target: 'intent' });
        },
      );
    },

    async runAction(action) {
      const sessionId = get().sessionId;
      if (!sessionId) return;
      if (action.kind === 'draft_email') {
        const kind = action.id === 'draft_pre_meeting_email' ? 'pre_meeting' : 'customer_update';
        set({ email: { status: 'loading', title: action.label } });
        try {
          const draft = await api.draftEmail(sessionId, kind);
          set({
            email: { status: 'ready', title: action.label, ...draft },
            announcement: 'Email draft ready',
          });
        } catch (err) {
          set({
            email: {
              status: 'error',
              title: action.label,
              error: err instanceof Error ? err.message : 'Could not draft the email',
            },
          });
        }
        return;
      }
      try {
        const { message } = await api.executeAction(sessionId, action.id, action.params);
        set((s) => ({
          actionsLog: [...s.actionsLog, { at: Date.now(), message }].slice(-20),
          toast: { id: Date.now(), message },
          announcement: message,
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Action failed';
        set({ toast: { id: Date.now(), message }, announcement: message });
      }
    },

    closeEmail: () => set({ email: null }),
    clearToast: (id) => set((s) => (s.toast?.id === id ? { toast: null } : {})),
    toggleLens: () =>
      set((s) => ({
        lensOn: !s.lensOn,
        announcement: s.lensOn ? 'Why lens off' : 'Why lens on. Scores and left-out panels shown.',
      })),
    cancelClarify: () => {
      if (!get().clarification) return;
      inflight?.abort();
      set({ clarification: null, phase: 'idle', stage: null, requestId: null });
      requestFocus({ target: 'intent' });
    },
    // Dismissed: unpin clears the dismissal. No-space: pin forces inclusion (Section 12.5).
    bringBack: (item) =>
      call(
        (id) => api.setPinned(id, item.componentId, item.reason === 'no_space'),
        (spec) => {
          showSpec(spec, 'replace');
          requestFocus({ target: 'panel', panelId: item.componentId });
        },
      ),
  };
});
