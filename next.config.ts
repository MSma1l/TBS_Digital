import type { NextConfig } from "next";

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
