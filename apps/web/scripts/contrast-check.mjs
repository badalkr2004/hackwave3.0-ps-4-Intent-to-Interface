/**
 * Assert token contrast: text >= 4.5:1, borders >= 3:1 vs bg/surface.
 * Usage: bun run ui:contrast
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const tokensPath = join(dirname(fileURLToPath(import.meta.url)), '../src/design/tokens.css');
const css = readFileSync(tokensPath, 'utf8');

function parseBlock(src, startMarker) {
  const i = src.indexOf(startMarker);
  if (i < 0) return {};
  const open = src.indexOf('{', i);
  let depth = 0;
  let end = open;
  for (; end < src.length; end++) {
    if (src[end] === '{') depth++;
    else if (src[end] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  const body = src.slice(open + 1, end);
  const vars = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    vars[m[1]] = m[2].trim();
  }
  return vars;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  if (h.length !== 6) return null;
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

function lin(c) {
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
}

function contrast(a, b) {
  const L1 = luminance(a);
  const L2 = luminance(b);
  if (L1 == null || L2 == null) return null;
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

function checkTheme(name, vars) {
  const fails = [];
  const bg = vars.bg;
  const surface = vars.surface;
  const checks = [
    ['text vs bg', vars.text, bg, 4.5],
    ['text vs surface', vars.text, surface, 4.5],
    ['muted vs bg', vars['text-muted'], bg, 4.5],
    ['muted vs surface', vars['text-muted'], surface, 4.5],
    ['border vs bg', vars.border, bg, 3],
    ['border vs surface', vars.border, surface, 3],
    ['border-strong vs bg', vars['border-strong'], bg, 3],
    ['accent-text vs accent-bg', vars['accent-text'], vars['accent-bg'], 4.5],
    ['on-accent vs accent', vars['on-accent'], vars.accent, 4.5],
    ['danger vs danger-bg', vars.danger, vars['danger-bg'], 4.5],
    ['warn vs warn-bg', vars.warn, vars['warn-bg'], 4.5],
    ['success vs success-bg', vars.success, vars['success-bg'], 4.5],
  ];
  for (const [label, fg, back, min] of checks) {
    if (!fg?.startsWith('#') || !back?.startsWith('#')) {
      fails.push(`${name}: ${label} — non-hex (${fg} / ${back})`);
      continue;
    }
    const ratio = contrast(fg, back);
    if (ratio == null || ratio < min) {
      fails.push(
        `${name}: ${label} = ${ratio?.toFixed(2) ?? '?'} (need ≥ ${min}) ${fg} on ${back}`,
      );
    } else {
      console.log(`ok  ${name}: ${label} = ${ratio.toFixed(2)}`);
    }
  }
  return fails;
}

const light = parseBlock(css, ':root {');
const dark = parseBlock(css, "@media (prefers-color-scheme: dark)");
const fails = [...checkTheme('light', light), ...checkTheme('dark', dark)];
if (fails.length) {
  console.error('\nContrast failures:');
  for (const f of fails) console.error(' -', f);
  process.exit(1);
}
console.log('\nAll contrast checks passed.');
