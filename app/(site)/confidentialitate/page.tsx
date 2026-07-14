import type { Metadata } from "next";
import { LegalDoc } from "./LegalDoc";
import { privacyContent } from "./content";

export const metadata: Metadata = {
  title: "Politica de confidențialitate — TBS Digital",
  description:
    "Cum prelucrează TBS Digital datele cu caracter personal, conform Legii nr. 133 și principiilor GDPR: ce date colectăm, în ce scopuri, temeiul juridic și drepturile tale.",
};

export default function PrivacyPage() {
  return <LegalDoc content={privacyContent} />;
}
