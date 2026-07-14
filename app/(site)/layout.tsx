import { headers } from "next/headers";
import { StatusBar } from "@/components/layout/StatusBar";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
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
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <>
      <ScrollProgress />
      <StatusBar />
      <Navbar />
      {children}
      <Footer />
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
