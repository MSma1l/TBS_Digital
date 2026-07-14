import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", contentSecurityPolicyHeaderValue);

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on every page document, but skip things that don't need (or shouldn't
     * pay for) a per-request nonce: API routes, static assets, image optimizer,
     * favicon, and link-prefetches.
     */
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
