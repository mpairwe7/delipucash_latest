import { test, expect } from '@playwright/test';

/**
 * Pixel visual-regression for the presentational question components.
 * Each Storybook story is rendered in react-native-web; we screenshot the story root and
 * diff it against the committed baseline. Regenerate baselines with
 * `bun run test:visual:update` (in the same OS as CI — see playwright.config.ts).
 */
const STORIES = [
  'question-presentational--response-card-default',
  'question-presentational--response-card-accepted',
  'question-presentational--hero-card-no-reward',
  'question-presentational--hero-card-with-reward',
  'question-presentational--detail-header',
  'question-presentational--detail-error',
  'question-presentational--answer-input-full',
  'question-presentational--answer-input-compact',
];

for (const id of STORIES) {
  test(id, async ({ page }) => {
    await page.goto(`/iframe.html?id=${id}&viewMode=story`);

    // Story content lives in #storybook-root (Storybook 7+).
    const root = page.locator('#storybook-root');
    await root.waitFor({ state: 'visible' });
    // Let fonts/layout settle before capturing.
    await page.waitForTimeout(300);

    await expect(root).toHaveScreenshot(`${id}.png`, {
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
    });
  });
}
