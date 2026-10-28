import { headers } from "next/headers";
// Tailwind utilities for the first-screen components. Imported here rather than in the root
// layout so the admin route never loads them (see the header of app/tailwind.css).
import "../tailwind.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { HudChrome } from "@/components/hud/HudChrome";
import { ScrollProgress } from "@/components/ui/ScrollProgress";
import { CookieConsent } from "@/components/ui/CookieConsent";
import { AnalyticsPixel } from "@/components/ui/AnalyticsPixel";

/** Marketing chrome for the public site. The admin route sits outside this group. */
export default async function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Per-request CSP nonce (set by proxy.ts). The analytics pixel below is a plain
  // hand-written <script>, so — unlike Next's own scripts — it isn't nonced
  // automatically; and under 'strict-dynamic' the host allow-list is ignored, so
  // the nonce is the only thing that lets it run.
  const requestHeaders = await headers();
  const nonce = requestHeaders.get("x-nonce") ?? undefined;

  return (
    <>
      {/* The service illustrations are hidden until the stage decides it will NOT draw
          (components/scene/art/ServiceArt.module.css): the drawing is the fallback, not a
          preamble. With no JavaScript there is no stage and no decision — `data-renderer` stays
          at the server's `pending` for ever — so this <noscript> style, which is only applied
          when scripting is off, shows them unconditionally. `[data-shape-art]` is the stable
          hook; the class itself is hashed by the CSS module. */}
      <noscript>
        <style>{`[data-shape-art]{opacity:1!important}[data-loading]{display:none!important}`}</style>
      </noscript>
      <ScrollProgress />
      <Navbar />
      {children}
      <Footer />
      {/* The HUD chrome (components/hud/HudChrome.tsx): the Ghid TBS guide, and later the rail
          and the OS layer. Nothing is server-rendered; its parts load only after an answered
          cookie banner, the visitor's first interaction and an idle slot. After
          the footer in the DOM, so its tab stops come after the page's own. */}
      <HudChrome />
      {/* GDPR / Legea 133 consent bar — shown until the visitor chooses. It records the
          choice (localStorage + cookie) and broadcasts it to the pixel below. */}
      <CookieConsent />
      {/* Analytics pixel, GATED on consent. It renders the statistica.tbs.md <script>
          ONLY after the visitor accepts analytics cookies — before that no t.js request
          and no tracking beacon fires. Mounted here (not the root layout) so it never
          loads on /admin-tbs-digital: the tracker's click handler reads `el.value` for
          inputs, which would ship the admin password to /px/collect. The nonce is kept
          on it so it satisfies the strict CSP ('strict-dynamic'); React hoists the async
          script into <head> and the tracker resolves its site id via
          document.currentScript, patching history itself so SPA navigations are counted. */}
      <AnalyticsPixel nonce={nonce} />
    </>
  );
}
