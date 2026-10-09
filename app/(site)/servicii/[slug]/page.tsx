import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { directionHref, directions } from "@/lib/directions";
import { DirectionPage } from "@/components/sections/DirectionPage";
import { SceneStage } from "@/components/scene/SceneStage";
import { ServiceArt } from "@/components/scene/art/ServiceArt";
import { OG_LOCALE, localeUrl, SITE_URL } from "@/lib/i18n/locales";
import { messages } from "@/lib/i18n/messages";
import { resolveContentLocale, resolveUrlLocale } from "@/lib/i18n/requestLocale";
import { SCENE_SHAPES, type SceneShape } from "@/lib/scene";
import { solutions } from "@/lib/solutions";

export function generateStaticParams() {
  return directions.map((d) => ({ slug: d.slug }));
}

export const dynamicParams = false;

/**
 * The direction's own title and description, in the language the visitor reads (the root
 * layout's rule: the URL's /ru or /en, then the cookie, then Accept-Language). The title is the
 * direction's name from the header menu (`dir.*`), the description its pitch — the words the
 * page itself opens with (lib/solutions.ts). Open Graph and Twitter are restated whole, because
 * a page's `openGraph` replaces the layout's rather than merging into it; canonical and hreflang
 * still come from the layout.
 *
 * The pitch is indexed by hand rather than through `loc()`: lib/i18n/content.tsx is a client
 * module, and this runs on the server.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const dir = directions.find((d) => d.slug === slug);
  // `dynamicParams = false` already 404s anything else; this only narrows the type.
  if (!dir) return {};
  const locale = await resolveContentLocale();
  const urlLocale = await resolveUrlLocale();
  const title = `TBS Digital \u2014 ${messages[locale][dir.labelKey] || messages.ro[dir.labelKey]}`;
  const pitch = solutions[slug]?.pitch.text;
  const description = pitch ? pitch[locale] || pitch.ro : messages[locale]["meta.description"];
  return {
    title,
    description,
    openGraph: {
      type: "website",
      siteName: "TBS Digital",
      title,
      description,
      url: localeUrl(urlLocale, directionHref(slug)),
      locale: OG_LOCALE[locale],
    },
    twitter: { card: "summary_large_image", title, description },
  };
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
  const locale = await resolveContentLocale();
  const urlLocale = await resolveUrlLocale();
  const name = messages[locale][dir.labelKey] || messages.ro[dir.labelKey];
  const pitch = solutions[slug]?.pitch.text;
  const description = pitch ? pitch[locale] || pitch.ro : messages[locale]["meta.description"];
  const url = localeUrl(urlLocale, directionHref(slug));
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  // This schema describes the same offer the visitor reads on this page. It does not claim
  // pricing, reviews, locations or results that the site cannot prove; it simply connects a
  // focused service page to the Organization graph in the root layout.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${url}#service`,
    name,
    description,
    url,
    provider: { "@id": `${SITE_URL}/#organization` },
    areaServed: { "@type": "Country", name: "Moldova" },
    availableLanguage: ["ro", "ru", "en"],
  };
  return (
    <main>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <SceneStage>
        <DirectionPage slug={slug} modelArt={shape ? <ServiceArt shape={shape} /> : null} />
      </SceneStage>
    </main>
  );
}
