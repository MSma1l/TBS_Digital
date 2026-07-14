import type { Metadata } from "next";
import { headers } from "next/headers";
import { Archivo, JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";
import { SiteContentProvider } from "@/lib/siteContent";

const archivo = Archivo({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const manrope = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "TBS Digital — Software, aplicații și automatizări cu IA",
  description:
    "Digitalizăm afaceri prin software personalizat, aplicații mobile, automatizări cu IA, CRM, SaaS și platforme — de la strategie până la execuție.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Reading a request header opts the whole route tree into dynamic rendering so
  // the per-request CSP nonce minted in proxy.ts is applied to Next's scripts on
  // EVERY route — including /admin-tbs-digital, which sits outside the (site)
  // group. A nonce'd CSP over a statically prerendered page would serve HTML whose
  // scripts carry a stale/absent nonce and get blocked. See proxy.ts.
  await headers();

  return (
    <html
      lang="ro"
      className={`${archivo.variable} ${jetbrainsMono.variable} ${manrope.variable}`}
    >
      <body>
        <SiteContentProvider>{children}</SiteContentProvider>
      </body>
    </html>
  );
}
