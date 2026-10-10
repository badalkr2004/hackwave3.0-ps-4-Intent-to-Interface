import { useEffect, useState } from 'react';

export interface TokenColors {
  accent: string;
  muted: string;
  danger: string;
  border: string;
  text: string;
  surface: string;
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
  };
}

/** Resolved token colors for SVG presentation attributes, which cannot use var(). */
export function useTokenColors(): TokenColors {
  const [colors, setColors] = useState(read);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setColors(read());
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return colors;
}
