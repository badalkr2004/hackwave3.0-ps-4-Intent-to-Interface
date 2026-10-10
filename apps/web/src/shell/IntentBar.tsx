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
  return prompt.length > 36 ? `${prompt.slice(0, 34)}…` : prompt;
}

export interface IntentBarProps {
  busy: boolean;
  demoPrompts: string[];
  showSuggestions?: boolean;
  onSubmit: (text: string) => void;
  onHome: () => void;
}

export function IntentBar({
  busy,
  demoPrompts,
  showSuggestions = true,
  onSubmit,
  onHome,
}: IntentBarProps) {
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
    <div className="flex flex-col gap-2">
      <form
        role="search"
        aria-label="What you are working on"
        onSubmit={onFormSubmit}
        className="flex gap-2"
      >
        <label htmlFor={inputId} className="sr-only">
          What are you working on?
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={text}
          maxLength={500}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(null);
            markIntentEdited();
          }}
          placeholder="What are you working on?"
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          className="min-h-11 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-md text-text shadow-panel placeholder:text-muted"
        />
        <button
          type="submit"
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-on-accent"
        >
          {busy ? (
            <LoaderCircle aria-hidden className="size-4 animate-spin" />
          ) : (
            <ArrowRight aria-hidden className="size-4" />
          )}
          Show
        </button>
        <button
          type="button"
          onClick={onHome}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-text hover:bg-surface-2"
        >
          <House aria-hidden className="size-4" />
          <span className="hidden sm:inline">Overview</span>
          <span className="sm:hidden">Home</span>
        </button>
      </form>
      <p id={hintId} className="sr-only">
        Press slash to focus this field from anywhere.
      </p>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {showSuggestions && !busy && demoPrompts.length > 0 && (
        <ul aria-label="Try one of these" className="flex flex-wrap gap-2">
          {demoPrompts.map((p) => (
            <li key={p}>
              <button
                type="button"
                title={p}
                onClick={() => {
                  setText(p);
                  submit(p);
                }}
                className="min-h-8 rounded-md border border-border bg-bg px-2.5 text-xs text-muted hover:border-border-strong hover:text-text"
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
