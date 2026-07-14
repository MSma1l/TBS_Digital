import { Hero } from "@/components/sections/Hero";
import { Principles } from "@/components/sections/Principles";
import { Services } from "@/components/sections/Services";
import { Work } from "@/components/sections/Work";
import { Team } from "@/components/sections/Team";
import { Partners } from "@/components/sections/Partners";
import { Estimator } from "@/components/sections/Estimator";

export default function Home() {
  return (
    <main>
      <Hero />
      <Principles />
      <Services />
      <Work />
      <Team />
      <Partners />
      <Estimator />
    </main>
  );
}
