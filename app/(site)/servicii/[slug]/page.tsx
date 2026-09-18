import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { directions } from "@/lib/directions";
import { DirectionPage } from "@/components/sections/DirectionPage";
import { SceneStage } from "@/components/scene/SceneStage";
import { ServiceArt } from "@/components/scene/art/ServiceArt";
import { SCENE_SHAPES, type SceneShape } from "@/lib/scene";

export function generateStaticParams() {
  return directions.map((d) => ({ slug: d.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { title: `TBS Digital \u2014 ${slug}` };
}

/**
 * A direction page, wrapped in the SAME interior stage the home page uses: one WebGL canvas on
 * a sticky layer, drawing this direction's model into the host the hero opens with. The stage
 * is mounted HERE and not inside `DirectionPage`, exactly as `app/(site)/page.tsx` does it —
 * the stage is the page's shell, not one of its sections, and mounting it in the route keeps
 * `DirectionPage` a plain client section that still renders on its own (its tests do).
 *
 * `modelArt` is the static twin (`components/scene/art/ServiceArt.tsx`), server-rendered here
 * so the drawing ships in the HTML: it is what a device without the scene keeps, and what the
 * canvas crossfades from once `data-renderer="webgl"` (ServiceArt.module.css). Which model the
 * canvas draws is NOT decided here — `DirectionPage` writes the slug into the scene's input
 * store and the world reads that index every frame (`lib/scene.ts`).
 *
 * Only the five shipped directions have a drawing; `generateStaticParams` + `dynamicParams`
 * already pin the route to them, so the guard is a type narrowing, not a branch we expect.
 */
export default async function SolutionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dir = directions.find((d) => d.slug === slug);
  if (!dir) notFound();
  const shape = (SCENE_SHAPES as readonly string[]).includes(slug) ? (slug as SceneShape) : null;
  return (
    <main>
      <SceneStage>
        <DirectionPage slug={slug} modelArt={shape ? <ServiceArt shape={shape} /> : null} />
      </SceneStage>
    </main>
  );
}
