/**
 * Axe four gallery compositions; fail on serious/critical.
 * Usage: bun run ui:axe
 */
import { AxeBuilder } from '@axe-core/playwright';
import { chromium } from 'playwright';

const BASE = process.env.UI_SHOTS_BASE ?? 'http://127.0.0.1:5173';
const SHAPES = ['overview', 'prepare', 'diagnose', 'triage'];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let failed = false;

  for (const shape of SHAPES) {
    await page.goto(`${BASE}/gallery?shape=${shape}`, { waitUntil: 'networkidle' });
    const results = await new AxeBuilder({ page }).analyze();
    const bad = results.violations.filter((v) =>
      ['serious', 'critical'].includes(v.impact ?? ''),
    );
    if (bad.length) {
      failed = true;
      console.error(`\n${shape}: ${bad.length} serious/critical`);
      for (const v of bad) {
        console.error(`  [${v.impact}] ${v.id}: ${v.help}`);
        for (const n of v.nodes.slice(0, 3)) {
          console.error(`    - ${n.target.join(' ')}`);
        }
      }
    } else {
      console.log(`ok  ${shape} (${results.violations.length} minor/moderate ignored)`);
    }
  }

  await browser.close();
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
