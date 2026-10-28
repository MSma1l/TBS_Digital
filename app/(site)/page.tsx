import { Hero } from "@/components/sections/Hero";
import { Ticker } from "@/components/sections/Ticker";
import { Stakes } from "@/components/sections/Stakes";
import { Directions } from "@/components/sections/Directions";
import { Work } from "@/components/sections/Work";
import { WorkProof } from "@/components/sections/WorkProof";
import { Principles } from "@/components/sections/Principles";
import { Team } from "@/components/sections/Team";
import { Process } from "@/components/sections/Process";
import { Explainer } from "@/components/sections/Explainer";
import { RequestSection } from "@/components/sections/RequestSection";
import { SceneStage } from "@/components/scene/SceneStage";
import { HeroCoreArt } from "@/components/scene/art/HeroCoreArt";
import { ServiceArt } from "@/components/scene/art/ServiceArt";
import { SCENE_SHAPES } from "@/lib/scene";

/*
 * The interior stage wraps the sections its one WebGL canvas draws behind (Hero → Ticker →
 * Stakes → Directions → Work, whose project cards the scene turns round its DNA helix). Stakes
 * draws nothing in the scene: the core leaves on the hero's own scroll span and the services
 * model forms on Directions' anchor, so it only lengthens the quiet scroll between the two. The
 * static illustrations the page renders are server components
 * handed down as props, so their geometry is computed here and their markup ships in the HTML:
 * the hero's core, and the drawing of the direction Directions opens on (the first). A prop is
 * also serialised into the RSC payload, so only that ONE direction's drawing is passed —
 * Directions loads the other four in the browser the first time one is selected.
 *
 * The page follows the StoryBrand website wireframe (docs/16, "Copy framework"; docs/05, "The
 * wireframe order"): 1 the header (Hero + Ticker) · 2 the stakes (Stakes) · 3 the value
 * proposition (Directions) · 4 the guide — authority and empathy (Work, WorkProof, Principles,
 * Team) · 5 the three-step plan (Process) · 6 the story in prose (Explainer) · 7 the price
 * choices (RequestSection) · 8 the junk drawer (the footer, in the layout).
 */
export default function Home() {
  return (
    <main>
      <SceneStage>
        <Hero coreArt={<HeroCoreArt />} />
        <Ticker />
        <Stakes />
        <Directions initialArt={<ServiceArt shape={SCENE_SHAPES[0]} />} />
        <Work />
      </SceneStage>
      <WorkProof />
      <Principles />
      <Team />
      <Process />
      <Explainer />
      <RequestSection />
    </main>
  );
}
