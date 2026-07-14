import { headers } from "next/headers";
import { StatusBar } from "@/components/layout/StatusBar";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ScrollProgress } from "@/components/ui/ScrollProgress";

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
      {/* Analytics pixel. Mounted here rather than in the root layout so it never
          loads on /admin-tbs-digital: the tracker's click handler reads
          `el.value` for inputs, which would ship the admin password to
          /px/collect. Plain <script async> (not next/script) so React hoists it
          into the server-rendered <head> — the tracker resolves its site id via
          document.currentScript, and it patches history itself, so App Router
          client-side navigations are already counted. */}
      <script
        async
        nonce={nonce}
        src="https://statistica.tbs.md/px/t.js"
        data-site="6749e0d58765467495183773e68168a5"
      />
    </>
  );
}
