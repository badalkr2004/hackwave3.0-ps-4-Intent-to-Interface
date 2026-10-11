import { useEffect, useRef, useState } from 'react';
import { CircleAlert, LoaderCircle, MessageSquare, Send } from 'lucide-react';
import { AccessGate } from '../auth/AccessGate';
import {
  fetchChatHealth,
  streamChat,
  type ChatHealth,
  type ChatResult,
} from '../lib/chatApi';
import { fetchMe } from '../lib/orgApi';
import { AuthMenu } from '../shell/AuthMenu';
import { ThemeToggle } from '../shell/ThemeToggle';
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
    'What is our Acme renewal risk?',
  ],
  org_helios: [
    'Prepare me for Vertex tomorrow',
    'Why did Vertex usage drop?',
    'What’s overdue for Oakmont?',
    'What is our Vertex renewal risk?',
  ],
};

const DEFAULT_CHIPS: string[] = [
  'Prepare me for Acme tomorrow',
  'Why did Acme usage drop?',
  'What’s overdue for Globex?',
  'What is our Acme renewal risk?',
];

function Citations({ items }: { items: { id: string; label: string }[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-2">
      <span className="w-full text-[11px] tracking-wide text-muted uppercase">Sources</span>
      {items.map((c) => (
        <span
          key={c.id}
          title={c.id}
          className="rounded-md border border-border bg-surface-2 px-2 py-0.5 text-xs text-muted"
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}

function ChatApp() {
  const [health, setHealth] = useState<ChatHealth | null>(null);
  const [accessRole, setAccessRole] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const demoChips = CHIPS_BY_ORG[orgId ?? ''] ?? DEFAULT_CHIPS;
  const available = health?.available === true;

  useEffect(() => {
    document.title = 'Chat · Gestalt';
    void fetchChatHealth().then(setHealth);
    void fetchMe().then((me) => {
      const active = me.orgs.find((o) => o.id === me.activeOrganizationId) ?? me.orgs[0];
      setAccessRole(active?.accessRole ?? me.accessRole ?? null);
      setOrgId(active?.id ?? me.activeOrganizationId ?? null);
    });
    const t = window.setInterval(() => {
      void fetchChatHealth().then(setHealth);
    }, 15_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
        onResult: (result: ChatResult) => {
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
        },
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
    <div className="flex min-h-screen flex-col bg-canvas text-text">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex items-center gap-3">
          <a href="/app" className="font-display text-xl tracking-tight text-text">
            Gestalt
          </a>
          <span className="inline-flex items-center gap-1.5 text-sm text-muted">
            <MessageSquare className="size-4" aria-hidden />
            Chat
          </span>
          {accessRole && (
            <span className="rounded-sm bg-accent-bg px-2 py-0.5 text-xs font-medium tracking-wide text-accent-text uppercase">
              {accessRole}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/app"
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text hover:bg-surface-2"
          >
            Workspace
          </a>
          <ThemeToggle />
          <AuthMenu />
        </div>
      </header>

      {health && !available && (
        <div
          role="alert"
          className="flex items-start gap-2 border-b border-danger/30 bg-danger-bg px-5 py-3 text-sm text-danger"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Chatbot service: an error occurred</p>
            <p className="mt-0.5 text-danger/90">
              {health.message ?? 'The chat sidecar is unavailable.'} Your workspace still works —
              open <a className="underline" href="/app">Intent workspace</a>.
            </p>
          </div>
        </div>
      )}

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-5 py-6">
        <p className="text-sm text-muted">
          Conversational answers grounded in your org’s indexed docs (role-aware). Prefer the
          floating chat on the{' '}
          <a className="text-accent-text underline-offset-2 hover:underline" href="/app">
            workspace
          </a>
          .
        </p>

        <div className="flex flex-wrap gap-2">
          {demoChips.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={busy}
              onClick={() => void submit(chip)}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-text hover:bg-surface-2 disabled:opacity-50"
            >
              {chip}
            </button>
          ))}
        </div>

        <div className="flex flex-1 flex-col gap-4">
          {messages.length === 0 && (
            <p className="rounded-md border border-dashed border-border p-6 text-sm text-muted">
              Ask a normal question — meeting prep, usage drops, renewals, overdue work. You’ll get
              a streamed written answer plus source chips, not dashboard panels.
            </p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={
                m.role === 'user'
                  ? 'ml-8 rounded-md bg-accent-bg px-4 py-3 text-sm text-accent-text'
                  : m.error
                    ? 'mr-8 rounded-md bg-danger-bg px-4 py-3 text-sm text-danger'
                    : 'mr-8 rounded-md border border-border bg-surface px-4 py-3 text-sm'
              }
            >
              {m.streaming && !m.text && (
                <p className="inline-flex items-center gap-1.5 text-muted">
                  <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
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
          className="sticky bottom-4 flex gap-2 rounded-md border border-border bg-surface p-2 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={available ? 'Ask Gestalt chat…' : 'Chat unavailable — workspace still works'}
            disabled={busy}
            className="min-h-11 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-on-accent disabled:opacity-50"
          >
            {busy ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
            Send
          </button>
        </form>
      </main>
    </div>
  );
}

export function ChatPage() {
  return (
    <AccessGate>
      {() => <ChatApp />}
    </AccessGate>
  );
}
