import type { Metadata } from "next";
import { LegalDoc } from "../confidentialitate/LegalDoc";
import { cookieContent } from "./content";

export const metadata: Metadata = {
  title: "Politica de cookie — TBS Digital",
  description:
    "Ce cookie-uri și tehnologii de stocare locală folosește TBS Digital, categoriile lor și cum îți gestionezi consimțământul pentru cookie-urile de analiză.",
};

export default function CookiesPage() {
  return <LegalDoc content={cookieContent} />;
}
