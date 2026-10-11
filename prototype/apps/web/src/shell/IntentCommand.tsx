import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, House, LoaderCircle, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/button';
import { isTypingTarget, markIntentEdited } from '../lib/typing';
import { cn } from '../lib/utils';
import { INTENT_INPUT_ID } from './ids';

function chipLabel(prompt: string): string {
  const t = prompt.toLowerCase();
  if (t.includes('prepare') && t.includes('acme')) return 'Prep Acme meeting';
  if (t.includes('usage drop')) return 'Why usage dropped';
  if (t.includes('overdue')) return 'What’s overdue';
  if (t.includes('look into')) return 'Look into Acme';
  if (t.includes('sales') && t.includes('pie')) return 'Sales as pie chart';
  if (t.includes('sales report') || t.includes('sales analytics')) return 'Sales report';
  return prompt.length > 36 ? `${prompt.slice(0, 34)}…` : prompt;
}

export interface IntentCommandProps {
  busy: boolean;
  stageText?: string | null;
  demoPrompts: string[];
  showSuggestions?: boolean;
  onSubmit: (text: string) => void;
  onHome: () => void;
}

const EXTRA_PROMPTS = ['Show me the sales report in a pie chart'] as const;

export function IntentCommand({
  busy,
  stageText,
  demoPrompts,
  showSuggestions = true,
  onSubmit,
  onHome,
}: IntentCommandProps) {
  const prompts = [...demoPrompts, ...EXTRA_PROMPTS];
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = INTENT_INPUT_ID;
  const hintId = useId();
  const errorId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTypingTarget(e.target)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError('Say what you need help with.');
      return;
    }
    if (trimmed.length > 500) {
      setError('Keep it under 500 characters.');
      return;
    }
    setError(null);
    onSubmit(trimmed);
  };

  return (
    <div className="w-full">
      <form
        role="search"
        aria-label="What you are working on"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          submit(text);
        }}
        className="relative overflow-hidden rounded-xl border border-border bg-surface/90 shadow-panel backdrop-blur-sm"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              'radial-gradient(ellipse 70% 100% at 10% 0%, var(--gradient-a), transparent 55%)',
          }}
        />
        <div className="relative flex flex-col gap-0 sm:flex-row sm:items-stretch">
          <div className="relative min-w-0 flex-1">
            <label htmlFor={inputId} className="sr-only">
              What are you working on?
            </label>
            <div className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-accent">
              <Sparkles aria-hidden className="size-4" />
            </div>
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              value={text}
              maxLength={500}
              disabled={busy}
              onChange={(e) => {
                setText(e.target.value);
                if (error) setError(null);
                markIntentEdited();
              }}
              placeholder={busy ? stageText || 'Reshaping workbench…' : 'What are you working on?'}
              aria-describedby={error ? `${hintId} ${errorId}` : hintId}
              aria-invalid={error ? true : undefined}
              autoComplete="off"
              className={cn(
                'h-14 w-full bg-transparent pr-14 pl-11 text-md text-text placeholder:text-muted',
                'focus-visible:outline-none',
              )}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-sm border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-muted"
            >
              /
            </span>
          </div>
          <div className="flex gap-2 border-t border-border p-2 sm:border-t-0 sm:border-l sm:p-2">
            <Button type="submit" disabled={busy} className="h-10 flex-1 sm:flex-none">
              {busy ? (
                <LoaderCircle aria-hidden className="size-4 animate-spin" />
              ) : (
                <ArrowRight aria-hidden className="size-4" />
              )}
              {busy ? 'Working' : 'Go'}
            </Button>
            <Button type="button" variant="secondary" onClick={onHome} className="h-10">
              <House aria-hidden className="size-4" />
              <span className="hidden sm:inline">Overview</span>
            </Button>
          </div>
        </div>
      </form>
      <p id={hintId} className="sr-only">
        Press slash to focus this field from anywhere.
      </p>
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      {showSuggestions && !busy && prompts.length > 0 && (
        <ul aria-label="Try one of these" className="mt-3 flex flex-wrap gap-2">
          {prompts.map((p) => (
            <li key={p}>
              <button
                type="button"
                title={p}
                onClick={() => {
                  setText(p);
                  submit(p);
                }}
                className="min-h-8 rounded-md border border-border bg-surface/60 px-2.5 text-13 text-muted transition-colors hover:border-accent/40 hover:text-text"
              >
                {chipLabel(p)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
