import { Hero } from "@/components/sections/Hero";
import { Principles } from "@/components/sections/Principles";
import { Services } from "@/components/sections/Services";
import { Work } from "@/components/sections/Work";
import { Team } from "@/components/sections/Team";
import { Partners } from "@/components/sections/Partners";
import { Estimator } from "@/components/sections/Estimator";
import { SectionCTA } from "@/components/ui/SectionCTA";

export default function Home() {
  return (
    <main>
      <Hero />
      <Principles />
      <SectionCTA hue="cyan" />
      <Services />
      <SectionCTA hue="violet" />
      <Work />
      <SectionCTA hue="amber" />
      <Team />
      <SectionCTA hue="blue2" />
      <Partners />
      {/* Partners ends with its own "become a partner" panel; the estimator IS the
          contact form, so no extra CTA between them. */}
      <Estimator />
    </main>
  );
}
