import { defineConfig, devices } from '@playwright/test';

/**
 * Visual-regression config — screenshots the presentational question stories rendered by
 * Storybook (react-native-web) and pixel-diffs them against committed baselines.
 *
 * Baselines are platform-specific (font rasterisation differs by OS), so they live under
 * `e2e-visual/__screenshots__/<platform>/` and should be generated/refreshed in a pinned
 * environment (the same OS as CI). Generate/update with `bun run test:visual:update`.
 */
export default defineConfig({
  testDir: './e2e-visual',
  snapshotPathTemplate: 'e2e-visual/__screenshots__/{platform}/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:6007',
  },
  projects: [
    {
      // Viewport width matches the 420px story frame so #storybook-root captures just the
      // component (no empty background strip).
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 420, height: 900 }, deviceScaleFactor: 1 },
    },
  ],
  // Serves the pre-built static Storybook. Build it first: `bun run build-storybook`.
  webServer: {
    command: 'python3 -m http.server 6007 --directory storybook-static',
    url: 'http://localhost:6007',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
