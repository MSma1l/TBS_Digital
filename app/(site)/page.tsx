import { Hero } from "@/components/sections/Hero";
import { Ticker } from "@/components/sections/Ticker";
import { Directions } from "@/components/sections/Directions";
import { Work } from "@/components/sections/Work";
import { WorkProof } from "@/components/sections/WorkProof";
import { Principles } from "@/components/sections/Principles";
import { Team } from "@/components/sections/Team";
import { Process } from "@/components/sections/Process";
import { RequestSection } from "@/components/sections/RequestSection";
import { SceneStage } from "@/components/scene/SceneStage";
import { HeroCoreArt } from "@/components/scene/art/HeroCoreArt";
import { ServiceArt } from "@/components/scene/art/ServiceArt";
import { SCENE_SHAPES } from "@/lib/scene";

/*
 * The interior stage wraps the four sections its one WebGL canvas draws behind (Hero →
 * Ticker → Directions → Work, whose project cards the scene turns round its DNA helix). The
 * static illustrations the page renders are server components
 * handed down as props, so their geometry is computed here and their markup ships in the HTML:
 * the hero's core, and the drawing of the direction Directions opens on (the first). A prop is
 * also serialised into the RSC payload, so only that ONE direction's drawing is passed —
 * Directions loads the other four in the browser the first time one is selected.
 *
 * The page sells (2026-10-09, the owner: the services and the way to ask for them first): what
 * we do and for whom, the services with their starting prices and a request each, the proof — the
 * projects, then a way to ask for one like them and the partners — why us, the team, how starting
 * works, and the request with its price as the close.
 */
export default function Home() {
  return (
    <main>
      <SceneStage>
        <Hero coreArt={<HeroCoreArt />} />
        <Ticker />
        <Directions initialArt={<ServiceArt shape={SCENE_SHAPES[0]} />} />
        <Work />
      </SceneStage>
      <WorkProof />
      <Principles />
      <Team />
      <Process />
      <RequestSection />
    </main>
  );
}
