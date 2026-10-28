import { Hero } from "@/components/sections/Hero";
import { Ticker } from "@/components/sections/Ticker";
import { Directions } from "@/components/sections/Directions";
import { Work } from "@/components/sections/Work";
import { WorkProof } from "@/components/sections/WorkProof";
import { Principles } from "@/components/sections/Principles";
import { Team } from "@/components/sections/Team";
import { Process } from "@/components/sections/Process";
import { RequestSection } from "@/components/sections/RequestSection";
import { Stakes } from "@/components/sections/Stakes";
import { Explainer } from "@/components/sections/Explainer";
import { SceneStage } from "@/components/scene/SceneStage";
import { HeroCoreArt } from "@/components/art/HeroCoreArt";
import { ServiceArt } from "@/components/art/ServiceArt";
import { SERVICE_SHAPES } from "@/components/art/shapes";

/*
 * Only Work has WebGL (2026-10-28: the 3D scene on the first screen made the site too heavy):
 * its stage loads three.js and GSAP only once Work approaches the viewport, and draws the
 * projects' DNA helix; everywhere else the art is static SVG. The static illustrations the page renders are server components
 * handed down as props, so their geometry is computed here and their markup ships in the HTML:
 * the hero's core, and the drawing of the direction Directions opens on (the first). A prop is
 * also serialised into the RSC payload, so only that ONE direction's drawing is passed —
 * Directions loads the other four in the browser the first time one is selected.
 *
 * The page follows the "Marketing Made Simple" (StoryBrand) website wireframe (2026-10-28):
 * header (Hero) → stakes (Stakes) → value (Directions) → the guide's authority and empathy (Work,
 * WorkProof, Principles, Team) → the plan (Process) → the explanatory paragraph (Explainer) →
 * price choices (RequestSection) → the footer from the layout. See docs/05-page-sections.md.
 */
export default function Home() {
  return (
    <main>
      <Hero coreArt={<HeroCoreArt />} />
      <Ticker />
      <Stakes />
      <Directions initialArt={<ServiceArt shape={SERVICE_SHAPES[0]} />} />
      <SceneStage>
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
