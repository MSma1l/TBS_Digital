import type { Metadata } from "next";
import { Archivo, JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";
import { StatusBar } from "@/components/layout/StatusBar";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ScrollProgress } from "@/components/ui/ScrollProgress";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ro"
      className={`${archivo.variable} ${jetbrainsMono.variable} ${manrope.variable}`}
    >
      <body>
        <ScrollProgress />
        <StatusBar />
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  );
}
