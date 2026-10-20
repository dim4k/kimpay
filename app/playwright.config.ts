/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // The service worker installs in every fresh context, and a full page
    // load (page.goto) started while it installs or claims the page can hang
    // on Chromium. Tests that exercise it opt in with
    // `test.use({ serviceWorkers: 'allow' })`.
    serviceWorkers: 'block',
    // English, in a euro-zone country: new groups get the euro, as the
    // amounts in the tests expect (see guessCurrency).
    locale: 'en-IE',
  },
  // Test both desktop and mobile browsers. Tests tagged '@chromium-only'
  // check a server behaviour (hooks, routes, cron): one browser is enough.
  // The screens they go through are covered on both by other tests.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 13'] }, grepInvert: /@chromium-only/ },
  ],
  webServer: {
    // Serve the adapter-static SPA build (with index.html fallback), matching
    // the production nginx setup. `node build` was an adapter-node leftover.
    command: 'npm run preview -- --port 3000 --strictPort',
    url: 'http://localhost:3000',
    reuseExistingServer: !isCI,
    timeout: 60 * 1000,
  },
});
