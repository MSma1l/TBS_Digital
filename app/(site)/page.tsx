import { Hero } from "@/components/sections/Hero";
import { Ticker } from "@/components/sections/Ticker";
import { Directions } from "@/components/sections/Directions";
import { Work } from "@/components/sections/Work";
import { Principles } from "@/components/sections/Principles";
import { Team } from "@/components/sections/Team";
import { RequestSection } from "@/components/sections/RequestSection";
import { BottomCTA } from "@/components/sections/BottomCTA";
import { SceneStage } from "@/components/scene/SceneStage";
import { HeroCoreArt } from "@/components/scene/art/HeroCoreArt";
import { ServiceArt } from "@/components/scene/art/ServiceArt";
import { SCENE_SHAPES } from "@/lib/scene";

/*
 * The interior stage wraps the three sections its one WebGL canvas draws behind (Hero →
 * Ticker → Directions). The static illustrations the page renders are server components
 * handed down as props, so their geometry is computed here and their markup ships in the HTML:
 * the hero's core, and the drawing of the direction Directions opens on (the first). A prop is
 * also serialised into the RSC payload, so only that ONE direction's drawing is passed —
 * Directions loads the other four in the browser the first time one is selected.
 */
export default function Home() {
  return (
    <main>
      <SceneStage>
        <Hero coreArt={<HeroCoreArt />} />
        <Ticker />
        <Directions initialArt={<ServiceArt shape={SCENE_SHAPES[0]} />} />
      </SceneStage>
      <Work />
      <Principles />
      <Team />
      <RequestSection />
      <BottomCTA />
    </main>
  );
}
