import { Hero } from "@/components/sections/Hero";
import { Ticker } from "@/components/sections/Ticker";
import { Directions } from "@/components/sections/Directions";
import { Work } from "@/components/sections/Work";
import { Principles } from "@/components/sections/Principles";
import { Team } from "@/components/sections/Team";
import { Estimator } from "@/components/sections/Estimator";
import { BottomCTA } from "@/components/sections/BottomCTA";

export default function Home() {
  return (
    <main>
      <Hero />
      <Ticker />
      <Directions />
      <Work />
      <Principles />
      <Team />
      <Estimator />
      <BottomCTA />
    </main>
  );
}
