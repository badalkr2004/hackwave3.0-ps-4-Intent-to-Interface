import { useEffect, useRef, useState } from 'react';
import { CircleAlert, LoaderCircle, MessageSquare, Send, X } from 'lucide-react';
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
  const [health, setHealth] = useState<ChatHealth | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [accessRole, setAccessRole] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chips = CHIPS_BY_ORG[orgId ?? ''] ?? [
    'Prepare me for Acme tomorrow',
    'Why did Acme usage drop?',
    'What’s overdue for Globex?',
  ];
  const available = health?.available === true;

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
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

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

  return (
    <div className="pointer-events-none fixed right-4 bottom-24 z-50 flex flex-col items-end gap-3 sm:bottom-6">
      {open && (
        <div
          className="pointer-events-auto flex max-h-[min(78vh,640px)] w-[min(100vw-2rem,440px)] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-panel"
          role="dialog"
          aria-label="Gestalt chat"
        >
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
            <button
              type="button"
              aria-label="Close chat"
              onClick={() => setOpen(false)}
              className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text"
            >
              <X className="size-4" />
            </button>
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
                Ask anything about your clients, meetings, usage, or tickets. Answers are written
                from documents you’re allowed to see — like ChatGPT, with your org as context.
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
        </div>
      )}

      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? 'Close Gestalt chat' : 'Open Gestalt chat'}
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto inline-flex size-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-panel transition-transform hover:scale-105"
      >
        {open ? <X className="size-6" /> : <MessageSquare className="size-6" />}
      </button>
    </div>
  );
}
