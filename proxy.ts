import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DEFAULT_LOCALE, splitLocalePath } from "@/lib/i18n/locales";
import { INTRO_HEADER, INTRO_SKIP, fromAd } from "@/lib/intro";

/*
 * Per-request Content-Security-Policy (Next 16 "Proxy" — the renamed Middleware).
 *
 * MEDIU-1 backstop: the admin JWT lives in localStorage, so a strict CSP is the
 * last line of defence if any XSS ever slips through. `script-src` therefore
 * carries NO 'unsafe-inline' / 'unsafe-eval' (in prod) — inline scripts run only
 * with the per-request nonce below. Next.js reads that nonce out of the CSP header
 * we set on the request and stamps it onto every framework/runtime/bundle script
 * automatically (see node_modules/next/dist/docs/.../content-security-policy.md).
 * With 'strict-dynamic', same-origin/host allow-lists are IGNORED for scripts, so
 * the one hand-written <script> (the analytics pixel) is given the nonce directly
 * in app/(site)/layout.tsx.
 *
 * Because the nonce is minted per request, every page must be dynamically rendered
 * — enforced by `await headers()` in app/layout.tsx.
 *
 * Ref: node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md
 *      node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  // The backend that the browser talks to. In production the site and API share
  // an origin (nginx proxies /api/ → backend) so 'self' already covers it and
  // NEXT_PUBLIC_API_URL is unset. In dev / this-build's verification it is a
  // separate origin (http://localhost:8000) that img-src + connect-src must allow.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  let apiOrigin = "";
  try {
    if (apiUrl) apiOrigin = new URL(apiUrl).origin;
  } catch {
    /* malformed URL — fall back to same-origin only */
  }
  // A plain-http backend (local dev/testing) must NOT be force-upgraded to https,
  // which would break every API call; only emit upgrade-insecure-requests when the
  // policy contains no http:// origin (i.e. real production over TLS).
  const hasHttpOrigin = apiOrigin.startsWith("http://");

  // Self-hosted analytics pixel (statistica.tbs.md/px/t.js) — the script itself is
  // trusted via the nonce; its beacons are covered here.
  const pixelHost = "https://statistica.tbs.md";

  const connectSrc = ["'self'", pixelHost, apiOrigin].filter(Boolean).join(" ");
  const imgSrc = ["'self'", "data:", "blob:", apiOrigin].filter(Boolean).join(" ");

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline';
    img-src ${imgSrc};
    font-src 'self';
    connect-src ${connectSrc};
    object-src 'none';
    base-uri 'none';
    form-action 'self';
    frame-ancestors 'none';
    ${hasHttpOrigin ? "" : "upgrade-insecure-requests;"}
`;

  const contentSecurityPolicyHeaderValue = cspHeader
    .replace(/\s{2,}/g, " ")
    .trim();

  // Next.js extracts the nonce from the CSP header on the *request*, so it must be
  // set there as well as on the response the browser enforces.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicyHeaderValue);

  // Multilingual SEO (additive; independent of the CSP above). next.config.ts rewrites the
  // crawlable `/ru` and `/en` prefixes onto the default routes, but the App Router root
  // layout — which renders <html lang> and resolves canonical/hreflang/OG metadata — cannot
  // read the request path or the rewrite's query. So expose the URL's locale and the
  // prefix-stripped path as request headers, the same channel the nonce already travels on.
  // `x-locale` is set ONLY for an explicit /ru or /en prefix, so the default `/` keeps its
  // cookie/Accept-Language behaviour untouched. `x-pathname` lets the layout build a correct
  // self-canonical for every route (home and the legal pages alike).
  const { locale: urlLocale, rest: localeStrippedPath } = splitLocalePath(
    request.nextUrl.pathname,
  );
  requestHeaders.set("x-pathname", localeStrippedPath);
  if (urlLocale !== DEFAULT_LOCALE) requestHeaders.set("x-locale", urlLocale);

  // The intro's ad bypass (lib/intro.ts `fromAd`), on the same channel and for the same reason:
  // the `(site)` layout that gates the first-visit intro cannot read the query string. A URL
  // carrying a `utm_*` tag or an ad platform's click id (gclid, fbclid, …) goes through as
  // `x-intro: skip`, and the layout renders no overlay. Deleted first: the header is this
  // function's verdict, so a copy the browser sent with the request must never reach the layout.
  requestHeaders.delete(INTRO_HEADER);
  if (fromAd(request.nextUrl.searchParams)) requestHeaders.set(INTRO_HEADER, INTRO_SKIP);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", contentSecurityPolicyHeaderValue);

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on every page DOCUMENT, and skip only what neither needs nor should pay for a
     * per-request nonce: API routes, static assets, the image optimizer, the icon, and the
     * router's own RSC prefetches.
     *
     * `icon.svg` replaced `favicon.ico` here when app/icon.svg became the site's icon (the
     * App Router serves the file-based icon at /icon.svg).
     *
     * **`{ key: "purpose", value: "prefetch" }` is deliberately NOT here** (2026-09-25),
     * although Next's own CSP guide lists it. That recipe assumes this function only adds a
     * nonce; here it also carries `x-pathname`, which the root layout turns into the
     * self-canonical, the hreflang set AND the first-visit intro's gate (`shouldPlayIntro`).
     * The legacy `Purpose: prefetch` header is sent by BROWSERS, not by this Next version's
     * router (which sends `next-router-prefetch` and nothing else — checked in
     * `next/dist/client/components/app-router-headers.js`), and Chrome sends it when it
     * preloads a URL it predicted from that profile's own history. So the visitor who comes
     * back most often — the owner typing the address and pressing Enter — was being served a
     * document with no `x-pathname`: no intro, no canonical, and no CSP header at all.
     * Measured on the running container: `GET /` carried `id="tbs-intro"` once, the same
     * request with `Purpose: prefetch` carried it zero times.
     */
    {
      source: "/((?!api|_next/static|_next/image|icon.svg).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
};
