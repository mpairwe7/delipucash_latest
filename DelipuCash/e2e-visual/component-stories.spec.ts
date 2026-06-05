import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Pixel visual-regression for all presentational component stories (question + survey).
 * Story IDs are read from the built Storybook index (`test:visual` builds it first), so new
 * stories are covered automatically. Each story root is screenshotted and diffed against the
 * committed baseline (e2e-visual/__screenshots__/<platform>/). Regenerate with
 * `bun run test:visual:update` in the same OS as CI (see playwright.config.ts).
 */
const indexPath = path.resolve(__dirname, '../storybook-static/index.json');
const entries = JSON.parse(fs.readFileSync(indexPath, 'utf-8')).entries as Record<
  string,
  { id: string; type: string }
>;
const STORIES = Object.values(entries)
  .filter((e) => e.type === 'story')
  .map((e) => e.id);

for (const id of STORIES) {
  test(id, async ({ page }) => {
    await page.goto(`/iframe.html?id=${id}&viewMode=story`);

    const root = page.locator('#storybook-root');
    await root.waitFor({ state: 'visible' });
    await page.waitForTimeout(300);

    await expect(root).toHaveScreenshot(`${id}.png`, {
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
    });
  });
}
