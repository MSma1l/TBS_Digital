import { defineConfig, devices } from "@playwright/test";

/*
 * End-to-end tests (Playwright) for the public site.
 *
 * Scope split with the unit tests: Vitest (`npm test`) renders components in jsdom and
 * covers logic; Playwright drives a REAL production build in a real browser and covers the
 * things jsdom cannot see — routing/redirects, cookie-driven SSR (theme + language),
 * layout at real viewport widths, and keyboard/focus behaviour.
 *
 * Everything lives in `e2e/` and is named `*.spec.ts`. Vitest's `include` is
 * `**\/*.test.{ts,tsx}`, so these files are invisible to it and `npm test` stays a pure
 * unit run — keep the `.spec.ts` suffix for that reason (see e2e/README.md).
 */

/** A port nothing else in this project uses: 3000 is `next dev`, 8000 is the backend. */
const PORT = Number(process.env.E2E_PORT ?? 3210);

/**
 * `localhost` rather than `127.0.0.1` on purpose: the CSP emitted by `proxy.ts` contains
 * `upgrade-insecure-requests` whenever no plain-http API origin is configured, and
 * `localhost` is a "potentially trustworthy" origin that browsers never upgrade.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts$/,

  /* Traces / screenshots / the HTML report all land under e2e/.artifacts, which
     e2e/.gitignore keeps out of the repo. */
  outputDir: "./e2e/.artifacts/results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "e2e/.artifacts/html", open: "never" }],
  ],

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 45_000,
  expect: { timeout: 7_000 },

  use: {
    baseURL: BASE_URL,
    /* Pins Accept-Language, which is what the root layout falls back to when a visitor has
       no `tbs_locale` cookie — without this the default language would depend on the
       machine running the tests. */
    locale: "ro-RO",
    timezoneId: "Europe/Chisinau",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },

  /* Chromium only. The suite tests layout and behaviour, not engine quirks, and a single
     browser keeps `npx playwright install` to one download. Add webkit/firefox projects
     here if cross-engine coverage is ever wanted. */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],

  webServer: {
    /*
     * A production build, not `next dev`: the theme/language cookies are read during SSR
     * and the redirects come from next.config.ts — dev-only behaviour (Fast Refresh, dev
     * overlay, relaxed CSP) would not be representative.
     *
     * And specifically the STANDALONE server, not `next start`. next.config.ts sets
     * `output: "standalone"`, and `next start` refuses to work with it: the client
     * reference manifests for route-group pages are not where it looks, so
     * `/servicii/<slug>` 500s and the client bundle never hydrates. `.next/standalone`
     * ships without `static/` and `public/`, so they are copied next to server.js first —
     * exactly the three steps the production Dockerfile performs.
     *
     * POSIX shell (rm/cp). The project builds and deploys on Linux/macOS.
     */
    command: [
      "npm run build",
      "rm -rf .next/standalone/.next/static .next/standalone/public",
      "cp -R .next/static .next/standalone/.next/static",
      "cp -R public .next/standalone/public",
      "node .next/standalone/server.js",
    ].join(" && "),
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 420_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      /* `.next/standalone/server.js` reads its port/host from the environment. */
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      /*
       * Empty on purpose. `lib/api.ts` uses `NEXT_PUBLIC_API_URL ?? "http://localhost:8000"`,
       * so an empty string (not undefined) makes every API call SAME-ORIGIN
       * (`/api/contact`). Two things follow, both of which the suite depends on:
       *  · `page.route()` can stub the contact endpoint without a cross-origin preflight
       *    that Playwright would not intercept — no lead ever reaches a real backend;
       *  · the site renders from its bundled defaults when no backend is running, so the
       *    E2E run needs Next only, not the whole Docker stack.
       * Next's env loader does not overwrite a variable that is already set in the
       * environment, so this wins over the `NEXT_PUBLIC_API_URL` in `.env`.
       */
      NEXT_PUBLIC_API_URL: "",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
