import { useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  type PanInfo,
} from 'framer-motion';
import {
  CircleAlert,
  LoaderCircle,
  Maximize2,
  MessageSquare,
  Minimize2,
  Minus,
  Send,
  X,
} from 'lucide-react';
import {
  fetchChatHealth,
  streamChat,
  type ChatHealth,
  type ChatResult,
} from '../lib/chatApi';
import { fetchMe } from '../lib/orgApi';
import { ChatMarkdown } from './ChatMarkdown';

type Msg = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  citations?: { id: string; label: string }[];
  error?: boolean;
  streaming?: boolean;
  stage?: string;
};

type Corner = 'br' | 'bl' | 'tr' | 'tl';
type PanelSize = 'docked' | 'maximized';
type Pos = { x: number; y: number };

const CORNER_KEY = 'gestalt.chat.corner';
const SIZE_KEY = 'gestalt.chat.size';
const FAB_SIZE = 56;
const PAD = 16;
/** Extra bottom inset so FAB clears mobile chrome / footer links. */
const BOTTOM_EXTRA = 56;

const CHIPS_BY_ORG: Record<string, string[]> = {
  org_northwind: [
    'Prepare me for Acme tomorrow',
    'Why did Acme usage drop?',
    'What’s overdue for Globex?',
  ],
  org_helios: [
    'Prepare me for Vertex tomorrow',
    'Why did Vertex usage drop?',
    'What’s overdue for Oakmont?',
  ],
};

function readCorner(): Corner {
  try {
    const v = localStorage.getItem(CORNER_KEY);
    if (v === 'br' || v === 'bl' || v === 'tr' || v === 'tl') return v;
  } catch {
    /* ignore */
  }
  return 'br';
}

function readSize(): PanelSize {
  try {
    const v = localStorage.getItem(SIZE_KEY);
    if (v === 'docked' || v === 'maximized') return v;
  } catch {
    /* ignore */
  }
  return 'docked';
}

function cornerToPos(corner: Corner, vw = window.innerWidth, vh = window.innerHeight): Pos {
  const right = Math.max(PAD, vw - PAD - FAB_SIZE);
  const bottom = Math.max(PAD, vh - PAD - FAB_SIZE - BOTTOM_EXTRA);
  const left = PAD;
  const top = PAD;
  switch (corner) {
    case 'tl':
      return { x: left, y: top };
    case 'tr':
      return { x: right, y: top };
    case 'bl':
      return { x: left, y: bottom };
    case 'br':
    default:
      return { x: right, y: bottom };
  }
}

function nearestCorner(x: number, y: number, vw = window.innerWidth, vh = window.innerHeight): Corner {
  const cx = x + FAB_SIZE / 2;
  const cy = y + FAB_SIZE / 2;
  const candidates: { id: Corner; pos: Pos }[] = (
    ['tl', 'tr', 'bl', 'br'] as const
  ).map((id) => ({ id, pos: cornerToPos(id, vw, vh) }));

  let best: Corner = 'br';
  let bestDist = Infinity;
  for (const c of candidates) {
    const px = c.pos.x + FAB_SIZE / 2;
    const py = c.pos.y + FAB_SIZE / 2;
    const d = (cx - px) ** 2 + (cy - py) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = c.id;
    }
  }
  return best;
}

function panelShellClass(corner: Corner): string {
  const base = 'pointer-events-none fixed z-50 flex gap-3';
  switch (corner) {
    case 'bl':
      return `${base} left-4 bottom-[calc(1rem+3.5rem+0.75rem)] flex-col items-start`;
    case 'tr':
      return `${base} right-4 top-[calc(1rem+3.5rem+0.75rem)] flex-col items-end`;
    case 'tl':
      return `${base} left-4 top-[calc(1rem+3.5rem+0.75rem)] flex-col items-start`;
    case 'br':
    default:
      return `${base} right-4 bottom-[calc(1rem+3.5rem+0.75rem+2.5rem)] flex-col items-end sm:bottom-[calc(1rem+3.5rem+0.75rem)]`;
  }
}

function Citations({ items }: { items: { id: string; label: string }[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border pt-2">
      <span className="w-full text-[10px] tracking-wide text-muted uppercase">Sources</span>
      {items.map((c) => (
        <span
          key={c.id}
          title={c.id}
          className="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted"
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}

export function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<PanelSize>(() =>
    typeof window === 'undefined' ? 'docked' : readSize(),
  );
  const [corner, setCorner] = useState<Corner>(() =>
    typeof window === 'undefined' ? 'br' : readCorner(),
  );
  const [dragging, setDragging] = useState(false);
  const [snapHint, setSnapHint] = useState<Corner | null>(null);
  const [health, setHealth] = useState<ChatHealth | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [accessRole, setAccessRole] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const dragMoved = useRef(false);
  const [viewport, setViewport] = useState(() =>
    typeof window === 'undefined'
      ? { w: 1200, h: 800 }
      : { w: window.innerWidth, h: window.innerHeight },
  );
  const x = useMotionValue(
    typeof window === 'undefined' ? 0 : cornerToPos(readCorner()).x,
  );
  const y = useMotionValue(
    typeof window === 'undefined' ? 0 : cornerToPos(readCorner()).y,
  );

  const chips = CHIPS_BY_ORG[orgId ?? ''] ?? [
    'Prepare me for Acme tomorrow',
    'Why did Acme usage drop?',
    'What’s overdue for Globex?',
  ];
  const available = health?.available === true;
  const maximized = open && size === 'maximized';

  // Place FAB at corner on mount / corner change (when not dragging)
  useEffect(() => {
    if (dragging) return;
    const p = cornerToPos(corner, viewport.w, viewport.h);
    x.set(p.x);
    y.set(p.y);
  }, [corner, dragging, viewport.w, viewport.h, x, y]);

  useEffect(() => {
    const onResize = () => {
      const next = { w: window.innerWidth, h: window.innerHeight };
      setViewport(next);
      if (dragging) return;
      const p = cornerToPos(corner, next.w, next.h);
      x.set(p.x);
      y.set(p.y);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [corner, dragging, x, y]);

  useEffect(() => {
    void fetchChatHealth().then(setHealth);
    void fetchMe().then((me) => {
      const active = me.orgs.find((o) => o.id === me.activeOrganizationId) ?? me.orgs[0];
      setOrgId(active?.id ?? me.activeOrganizationId ?? null);
      setAccessRole(active?.accessRole ?? me.accessRole ?? null);
    });
    const t = window.setInterval(() => void fetchChatHealth().then(setHealth), 20_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CORNER_KEY, corner);
    } catch {
      /* ignore */
    }
  }, [corner]);

  useEffect(() => {
    try {
      localStorage.setItem(SIZE_KEY, size);
    } catch {
      /* ignore */
    }
  }, [size]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, size]);

  useEffect(() => {
    if (!maximized) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSize('docked');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [maximized]);

  const applyResult = (assistantId: string, result: ChatResult) => {
    const reply = result.clarification_needed
      ? `${result.reply ?? ''}\n\n${result.clarification_needed}`.trim()
      : (result.reply ?? '');
    setMessages((m) =>
      m.map((msg) =>
        msg.id === assistantId
          ? {
              ...msg,
              text: reply,
              citations: result.citations,
              streaming: false,
              stage: undefined,
            }
          : msg,
      ),
    );
  };

  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput('');
    const userMsg: Msg = { id: `u-${Date.now()}`, role: 'user', text: trimmed };
    const assistantId = `a-${Date.now()}`;
    setMessages((m) => [
      ...m,
      userMsg,
      { id: assistantId, role: 'assistant', text: '', streaming: true, stage: 'retrieving' },
    ]);
    if (!available) {
      setMessages((m) =>
        m.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                streaming: false,
                error: true,
                text: health?.message ?? 'Chatbot service: an error occurred.',
              }
            : msg,
        ),
      );
      return;
    }
    setBusy(true);
    const history = messages
      .filter((x) => !x.error)
      .map((x) => ({ role: x.role, content: x.text }))
      .filter((x) => x.content);
    try {
      await streamChat(trimmed, history, {
        onStatus: (stage) => {
          setMessages((m) =>
            m.map((msg) => (msg.id === assistantId ? { ...msg, stage } : msg)),
          );
        },
        onToken: (partial) => {
          setMessages((m) =>
            m.map((msg) =>
              msg.id === assistantId ? { ...msg, text: partial, stage: 'writing' } : msg,
            ),
          );
        },
        onResult: (result) => applyResult(assistantId, result),
        onError: (message) => {
          setMessages((m) =>
            m.map((msg) =>
              msg.id === assistantId
                ? { ...msg, text: message, error: true, streaming: false }
                : msg,
            ),
          );
          void fetchChatHealth().then(setHealth);
        },
      });
    } finally {
      setBusy(false);
    }
  };

  const minimize = () => {
    setOpen(false);
    setSize('docked');
  };

  const toggleMaximize = () => {
    setSize((s) => (s === 'maximized' ? 'docked' : 'maximized'));
  };

  const onFabDragStart = () => {
    dragMoved.current = false;
    setDragging(true);
    setOpen(false);
    setSize('docked');
  };

  const onFabDrag = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 4 || Math.abs(info.offset.y) > 4) {
      dragMoved.current = true;
    }
    const next = nearestCorner(x.get(), y.get(), viewport.w, viewport.h);
    setSnapHint(next);
  };

  const onFabDragEnd = async () => {
    const next = nearestCorner(x.get(), y.get(), viewport.w, viewport.h);
    const target = cornerToPos(next, viewport.w, viewport.h);
    setCorner(next);
    setSnapHint(null);
    await Promise.all([
      animate(x, target.x, { type: 'spring', stiffness: 520, damping: 36 }),
      animate(y, target.y, { type: 'spring', stiffness: 520, damping: 36 }),
    ]);
    setDragging(false);
    window.setTimeout(() => {
      dragMoved.current = false;
    }, 80);
  };

  const panelBody = (
    <>
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium text-text">
            <MessageSquare className="size-4 text-accent" aria-hidden />
            Gestalt chat
          </p>
          {accessRole && (
            <p className="truncate text-[11px] tracking-wide text-muted uppercase">
              {accessRole} · grounded in your docs
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            aria-label="Minimize chat"
            onClick={minimize}
            className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text"
            title="Minimize"
          >
            <Minus className="size-4" />
          </button>
          <button
            type="button"
            aria-label={maximized ? 'Restore chat size' : 'Maximize chat'}
            onClick={toggleMaximize}
            className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text"
            title={maximized ? 'Restore' : 'Maximize'}
          >
            {maximized ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
          <button
            type="button"
            aria-label="Close chat"
            onClick={() => {
              setOpen(false);
              setSize('docked');
            }}
            className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text"
            title="Close"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      {health && !available && (
        <div
          role="alert"
          className="flex gap-2 border-b border-danger/30 bg-danger-bg px-3 py-2 text-xs text-danger"
        >
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>Chatbot service: an error occurred — workspace still works.</span>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={busy}
              onClick={() => void submit(chip)}
              className="rounded-md border border-border bg-canvas px-2 py-1 text-[11px] text-text hover:bg-surface-2 disabled:opacity-50"
            >
              {chip}
            </button>
          ))}
        </div>

        {messages.length === 0 && (
          <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted">
            Drag the chat button anywhere — it snaps to the nearest corner so your dashboard stays
            clear.
          </p>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.role === 'user'
                ? 'ml-6 rounded-lg bg-accent-bg px-3 py-2 text-xs text-accent-text'
                : m.error
                  ? 'mr-2 rounded-lg bg-danger-bg px-3 py-2 text-xs text-danger'
                  : 'mr-2 rounded-lg border border-border bg-canvas px-3 py-2 text-xs text-text'
            }
          >
            {m.streaming && !m.text && (
              <p className="inline-flex items-center gap-1.5 text-muted">
                <LoaderCircle className="size-3 animate-spin" aria-hidden />
                {m.stage === 'writing' ? 'Writing…' : 'Looking up context…'}
              </p>
            )}
            {m.text &&
              (m.role === 'assistant' && !m.error ? (
                <ChatMarkdown content={m.text} streaming={m.streaming} />
              ) : (
                <p className="whitespace-pre-wrap leading-relaxed">
                  {m.text}
                  {m.streaming && <span className="chat-caret" aria-hidden />}
                </p>
              ))}
            {!m.streaming && m.citations && <Citations items={m.citations} />}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex gap-2 border-t border-border p-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={available ? 'Ask Gestalt chat…' : 'Chat unavailable'}
          disabled={busy}
          className="min-h-10 flex-1 rounded-md bg-canvas px-2 text-sm outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="inline-flex min-h-10 items-center gap-1 rounded-md bg-accent px-3 text-sm text-on-accent disabled:opacity-50"
        >
          {busy ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
          ) : (
            <Send className="size-4" aria-hidden />
          )}
        </button>
      </form>
    </>
  );

  return (
    <>
      {/* Corner snap guides while dragging */}
      <AnimatePresence>
        {dragging &&
          (['tl', 'tr', 'bl', 'br'] as const).map((c) => {
            const p = cornerToPos(c, viewport.w, viewport.h);
            const active = snapHint === c;
            return (
              <motion.div
                key={c}
                className="pointer-events-none fixed z-40 rounded-full border-2"
                style={{
                  left: p.x,
                  top: p.y,
                  width: FAB_SIZE,
                  height: FAB_SIZE,
                  borderColor: active ? 'var(--accent)' : 'var(--border)',
                  background: active ? 'var(--accent-bg)' : 'transparent',
                }}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: active ? 0.95 : 0.35, scale: active ? 1.05 : 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                aria-hidden
              />
            );
          })}
      </AnimatePresence>

      {/* Maximized overlay */}
      <AnimatePresence>
        {maximized && (
          <motion.div
            key="chat-max-backdrop"
            className="pointer-events-auto fixed inset-0 z-[60] bg-canvas/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSize('docked')}
            aria-hidden
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {maximized && (
          <motion.div
            key="chat-max-panel"
            layoutId="gestalt-chat-panel"
            role="dialog"
            aria-label="Gestalt chat"
            aria-modal="true"
            className="pointer-events-auto fixed inset-3 z-[70] flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-panel sm:inset-4 md:inset-5"
            initial={{ opacity: 0.96, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            {panelBody}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Docked panel near corner (above FAB) */}
      {!maximized && (
        <div className={panelShellClass(corner)}>
          <AnimatePresence mode="popLayout">
            {open && !dragging && (
              <motion.div
                key="chat-dock-panel"
                layoutId="gestalt-chat-panel"
                role="dialog"
                aria-label="Gestalt chat"
                className="pointer-events-auto flex max-h-[min(78vh,640px)] w-[min(100vw-2rem,440px)] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-panel"
                initial={{ opacity: 0, y: corner.startsWith('t') ? -10 : 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: corner.startsWith('t') ? -8 : 8, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              >
                {panelBody}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Draggable FAB — free float, snaps to nearest corner */}
      {!maximized && (
        <motion.button
          type="button"
          drag
          dragMomentum={false}
          dragElastic={0.12}
          dragConstraints={{
            left: PAD,
            top: PAD,
            right: Math.max(PAD, viewport.w - PAD - FAB_SIZE),
            bottom: Math.max(PAD, viewport.h - PAD - FAB_SIZE),
          }}
          style={{ x, y, width: FAB_SIZE, height: FAB_SIZE }}
          onDragStart={onFabDragStart}
          onDrag={onFabDrag}
          onDragEnd={() => void onFabDragEnd()}
          onClick={() => {
            if (dragMoved.current) return;
            setOpen((v) => !v);
          }}
          aria-expanded={open}
          aria-label={
            open ? 'Minimize Gestalt chat' : 'Open Gestalt chat — drag to move, snaps to a corner'
          }
          title="Drag to move · snaps to nearest corner"
          className="pointer-events-auto fixed top-0 left-0 z-50 inline-flex cursor-grab items-center justify-center rounded-full bg-accent text-on-accent shadow-panel active:cursor-grabbing"
          whileTap={{ scale: 0.96 }}
          whileHover={dragging ? undefined : { scale: 1.04 }}
        >
          {open ? <Minus className="size-6" /> : <MessageSquare className="size-6" />}
        </motion.button>
      )}

      {maximized && (
        <motion.button
          type="button"
          aria-label="Restore chat size"
          onClick={() => setSize('docked')}
          className="pointer-events-auto fixed z-50 inline-flex size-11 items-center justify-center rounded-full border border-border bg-surface text-text shadow-panel"
          style={{
            left: cornerToPos(corner, viewport.w, viewport.h).x + 2,
            top: cornerToPos(corner, viewport.w, viewport.h).y + 2,
          }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          whileTap={{ scale: 0.96 }}
          title="Restore"
        >
          <Minimize2 className="size-5" />
        </motion.button>
      )}
    </>
  );
}
