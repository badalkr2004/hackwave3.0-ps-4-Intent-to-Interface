import { useEffect, useState } from 'react';

export interface TokenColors {
  accent: string;
  muted: string;
  danger: string;
  border: string;
  text: string;
  surface: string;
  /** ~4% opacity grid lines for charts. */
  grid: string;
}

function read(): TokenColors {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    accent: v('--accent'),
    muted: v('--text-muted'),
    danger: v('--danger'),
    border: v('--border'),
    text: v('--text'),
    surface: v('--surface'),
    grid: v('--grid-faint') || 'rgba(26, 23, 20, 0.04)',
  };
}

/** Resolved token colors for SVG presentation attributes, which cannot use var(). */
export function useTokenColors(): TokenColors {
  const [colors, setColors] = useState(read);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setColors(read());
    mq.addEventListener('change', update);

    const observer = new MutationObserver(() => update());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => {
      mq.removeEventListener('change', update);
      observer.disconnect();
    };
  }, []);
  return colors;
}
