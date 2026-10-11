import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'dark';
    const saved = localStorage.getItem('gestalt-theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  });

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('gestalt-theme', next);
    } catch {
      // localStorage may fail in restricted sandbox
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium text-text transition-all duration-200 hover:border-accent hover:bg-surface-2"
    >
      {isDark ? (
        <>
          <Moon className="size-4 text-accent transition-transform duration-200 hover:-rotate-12" aria-hidden />
          <span className="hidden sm:inline">Dark</span>
        </>
      ) : (
        <>
          <Sun className="size-4 text-accent transition-transform duration-200 hover:rotate-45" aria-hidden />
          <span className="hidden sm:inline">Light</span>
        </>
      )}
    </button>
  );
}
