/**
 * Capture gallery (+ optional app shell) screenshots for UI polish before/after.
 * Usage: bun run ui:shots -- before|after
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../..');
const PHASE = process.argv[2] === 'after' ? 'after' : 'before';
const BASE = process.env.UI_SHOTS_BASE ?? 'http://127.0.0.1:5173';
const OUT = join(ROOT, 'docs/ui-shots', PHASE);

const VIEWPORTS = [
  { w: 1440, h: 900 },
  { w: 1024, h: 768 },
  { w: 390, h: 844 },
];
const THEMES = ['light', 'dark'];
const SHAPES = ['overview', 'prepare', 'diagnose', 'triage'];

async function setTheme(page, theme) {
  await page.emulateMedia({ colorScheme: theme });
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t);
  }, theme);
}

async function shot(page, name) {
  const path = join(OUT, `${name}.png`);
  mkdirSync(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage: true });
  console.log('wrote', path);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const theme of THEMES) {
    for (const { w, h } of VIEWPORTS) {
      await page.setViewportSize({ width: w, height: h });

      for (const shape of SHAPES) {
        await page.goto(`${BASE}/gallery?shape=${shape}`, { waitUntil: 'networkidle' });
        await setTheme(page, theme);
        await page.waitForTimeout(200);
        await shot(page, `${shape}-${w}-${theme}`);
      }

      // App shell (header + intent) when auth gate allows; skip if redirected to login.
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
      await setTheme(page, theme);
      await page.waitForTimeout(400);
      const url = page.url();
      if (!url.includes('/login') && !url.includes('/onboard')) {
        await shot(page, `app-${w}-${theme}`);
      } else {
        console.log('skip app shell (auth gate):', url);
      }
    }
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
