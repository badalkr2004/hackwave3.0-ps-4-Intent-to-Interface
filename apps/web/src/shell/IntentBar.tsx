import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, House, LoaderCircle } from 'lucide-react';

export interface IntentBarProps {
  busy: boolean;
  demoPrompts: string[];
  onSubmit: (text: string) => void;
  onHome: () => void;
}

const isTypingTarget = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

export function IntentBar({ busy, demoPrompts, onSubmit, onHome }: IntentBarProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const hintId = useId();

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
    if (!trimmed) return;
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
        aria-label="Workspace intent"
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
          onChange={(e) => setText(e.target.value)}
          placeholder="What are you working on?"
          aria-describedby={hintId}
          autoComplete="off"
          className="min-h-11 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-md text-text shadow-panel placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-surface disabled:opacity-50"
        >
          {busy ? (
            <LoaderCircle aria-hidden className="size-4 animate-spin" />
          ) : (
            <ArrowRight aria-hidden className="size-4" />
          )}
          Compose
        </button>
        <button
          type="button"
          onClick={onHome}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-text hover:bg-surface-2"
        >
          <House aria-hidden className="size-4" />
          Home
        </button>
      </form>
      <p id={hintId} className="sr-only">
        Press slash to focus this field from anywhere.
      </p>
      {!busy && demoPrompts.length > 0 && (
        <ul aria-label="Suggestions" className="flex flex-wrap gap-2">
          {demoPrompts.map((p) => (
            <li key={p}>
              <button
                type="button"
                onClick={() => {
                  setText(p);
                  submit(p);
                }}
                className="min-h-8 rounded-full border border-border bg-surface px-3 text-xs text-muted hover:border-accent hover:text-text"
              >
                {p}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
