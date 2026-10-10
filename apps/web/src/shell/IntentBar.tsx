import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, House, LoaderCircle } from 'lucide-react';
import { isTypingTarget, markIntentEdited } from '../lib/typing';
import { INTENT_INPUT_ID } from './ids';

/** Short chips for the demo lines — full text still submits. */
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

export interface IntentBarProps {
  busy: boolean;
  stageText?: string | null;
  demoPrompts: string[];
  showSuggestions?: boolean;
  onSubmit: (text: string) => void;
  onHome: () => void;
}

const EXTRA_PROMPTS = ['Show me the sales report in a pie chart'] as const;

export function IntentBar({
  busy,
  stageText,
  demoPrompts,
  showSuggestions = true,
  onSubmit,
  onHome,
}: IntentBarProps) {
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

  const onFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(text);
  };

  return (
    <div className="intent-shell flex w-full flex-col gap-2">
      <form
        role="search"
        aria-label="What you are working on"
        onSubmit={onFormSubmit}
        className="flex flex-col gap-2 sm:flex-row sm:items-stretch"
      >
        <div className="relative min-w-0 flex-1">
          <label htmlFor={inputId} className="sr-only">
            What are you working on?
          </label>
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
            placeholder={busy ? stageText || 'Arranging workspace…' : 'What are you working on?'}
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            aria-invalid={error ? true : undefined}
            autoComplete="off"
            className="h-14 w-full rounded-lg border border-border bg-surface pr-14 pl-4 text-md text-text shadow-panel transition-colors duration-150 placeholder:text-muted focus-visible:border-focus"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-sm border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-muted"
          >
            /
          </span>
          {busy && (
            <p className="sr-only" aria-live="polite">
              {stageText || 'Arranging workspace'}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-14 items-center gap-2 rounded-lg bg-accent px-5 text-sm font-medium text-on-accent transition-opacity duration-150 hover:opacity-95 disabled:opacity-70"
          >
            {busy ? (
              <LoaderCircle aria-hidden className="size-4 animate-spin" />
            ) : (
              <ArrowRight aria-hidden className="size-4" />
            )}
            {busy ? 'Working' : 'Show'}
          </button>
          <button
            type="button"
            onClick={onHome}
            className="inline-flex h-14 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-text transition-colors duration-150 hover:bg-surface-2"
          >
            <House aria-hidden className="size-4" />
            <span className="hidden sm:inline">Overview</span>
            <span className="sm:hidden">Home</span>
          </button>
        </div>
      </form>
      <p id={hintId} className="sr-only">
        Press slash to focus this field from anywhere.
      </p>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {showSuggestions && !busy && prompts.length > 0 && (
        <ul aria-label="Try one of these" className="flex flex-wrap gap-2">
          {prompts.map((p) => (
            <li key={p}>
              <button
                type="button"
                title={p}
                onClick={() => {
                  setText(p);
                  submit(p);
                }}
                className="min-h-8 rounded-md border border-border bg-bg px-2.5 text-13 text-muted transition-colors duration-150 hover:border-border-strong hover:text-text"
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
