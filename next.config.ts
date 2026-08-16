import type { NextConfig } from "next";

// The direction ("servicii") pages used to live at /solutions/<old-slug>. They were renamed
// to speaking Romanian slugs under /servicii/<new-slug>, but the old addresses are indexed,
// so every one of them must keep resolving instead of turning into a 404.
//
// This table is deliberately a literal rather than an import from lib/directions.ts:
// next.config.ts is loaded by the Next config loader, not by the app's module graph or its
// `@/` alias. `app/__tests__/servicii-routes.test.tsx` asserts it stays byte-for-byte in
// sync with `legacyDirectionRedirects()` in lib/directions.ts, so the two cannot drift.
const LEGACY_SOLUTION_ROUTES: { from: string; to: string }[] = [
  { from: "/solutions/digital", to: "/servicii/produs-digital" },
  { from: "/solutions/ecommerce", to: "/servicii/e-commerce" },
  { from: "/solutions/automation", to: "/servicii/automatizare-api" },
  { from: "/solutions/ai", to: "/servicii/asistenti-ia" },
  { from: "/solutions/brand", to: "/servicii/brand-ui" },
];

// The crawlable locale prefixes (lib/i18n/locales.ts LOCALE_PREFIX). A legacy URL exists in
// all three languages — /solutions/ai, /ru/solutions/ai, /en/solutions/ai — so each gets its
// own redirect that lands on the SAME prefix, keeping the visitor in their language.
const LOCALE_URL_PREFIXES = ["", "/ru", "/en"];

const nextConfig: NextConfig = {
  // Emit a self-contained build at .next/standalone (server.js + only the
  // node_modules actually traced as needed). Lets the Docker runtime image
  // ship without node_modules or a full `next start`.
  // Ref: node_modules/next/dist/docs/.../05-config/01-next-config-js/output.md
  output: "standalone",

  // Security headers applied to every route (clickjacking / MIME-sniffing /
  // referrer-leak hardening — the admin page in particular must never be
  // frameable). HSTS is intentionally omitted here: the reverse proxy /
  // backend owns TLS headers.
  //
  // The Content-Security-Policy is intentionally NOT set here: it now carries a
  // per-request nonce and is emitted from proxy.ts (a static header here would
  // produce a second, conflicting CSP — browsers enforce the intersection — and
  // could not carry a nonce). `frame-ancestors 'none'` is preserved inside that
  // proxy-generated policy; X-Frame-Options: DENY below is the redundant backstop.
  // Ref: node_modules/next/dist/docs/.../05-config/01-next-config-js/headers.md
  // Per-locale crawlable URLs. Romanian (default) is served at the root; Russian and
  // English get a path prefix (`/ru`, `/en`) so each language is independently crawlable
  // and hreflang-linked. These rewrites strip the prefix and render the SAME underlying
  // routes — the SSR language is selected from the `x-locale` request header that proxy.ts
  // derives from the URL (the App Router root layout cannot read the request path or a
  // rewrite's query itself, so the prefix must reach it via a header, exactly like the CSP
  // nonce). The on-page language switcher stays cookie-based for UX; these URLs exist so a
  // crawler can index every language. `afterFiles` order (the default array form) means real
  // routes like `/confidentialitate` win first and only unmatched `/ru…` paths are rewritten.
  // Ref: node_modules/next/dist/docs/.../05-config/01-next-config-js/rewrites.md
  // Permanent redirects for the renamed direction pages. Redirects are evaluated BEFORE
  // the filesystem and before the rewrites below, so `/ru/solutions/ai` is caught here and
  // never reaches the `/ru/:path*` rewrite. An explicit `statusCode: 301` is used instead of
  // `permanent: true` (which emits 308): these are GET-only content URLs and 301 is what
  // every crawler and legacy client understands without special-casing.
  // Ref: node_modules/next/dist/docs/.../05-config/01-next-config-js/redirects.md
  async redirects() {
    return LOCALE_URL_PREFIXES.flatMap((prefix) =>
      LEGACY_SOLUTION_ROUTES.map(({ from, to }) => ({
        source: `${prefix}${from}`,
        destination: `${prefix}${to}`,
        statusCode: 301,
      })),
    );
  },
  async rewrites() {
    return [
      { source: "/ru", destination: "/" },
      { source: "/en", destination: "/" },
      { source: "/ru/:path*", destination: "/:path*" },
      { source: "/en/:path*", destination: "/:path*" },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        // The admin panel must never be indexed. The navbar no longer links to it, but a
        // leaked URL (referrer, history sync) could still be crawled — this tells robots
        // not to. Deliberately NOT listed in robots.txt, which would only advertise it.
        source: "/admin-tbs-digital/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/admin-tbs-digital",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
