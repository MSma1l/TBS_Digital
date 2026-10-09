"use client";

import { Fragment, useRef, type CSSProperties } from "react";

import { useOffscreenAttribute } from "@/components/fx/useOffscreenAttribute";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

/* What we sell, in plain words and in this order. The first one leads each group in bold, the
   rest follow it. */
const LEAD = L(
  "Începe cu ce contează",
  "Начните с главного",
  "Start with what matters",
);
const ITEMS: LocalizedText[] = [
  L("MVP de test", "MVP для теста", "Test MVP"),
  L("Site-uri și e-commerce", "Сайты и e-commerce", "Websites & e-commerce"),
  L("CRM și automatizări", "CRM и автоматизация", "CRM & automation"),
  L("Feedback de la utilizatori", "Обратная связь от пользователей", "User feedback"),
  L("Dezvoltare etapizată", "Поэтапная разработка", "Staged development"),
];

/**
 * How many identical groups the track renders. The marquee keyframe (app/tailwind.css)
 * moves the track by exactly `-100% / --marquee-copies`, i.e. one group per loop, so the
 * seam lands on a copy of what was just there. Five copies keep the band covered up to
 * roughly four groups of viewport width (~4000px on desktop).
 */
export const TICKER_COPIES = 5;

/**
 * The slanted neon hairline between items. Empty on purpose: decoration, never read. The
 * skew is a transform, so its layout width stays 1px and every group keeps the same width.
 */
const SEP_CLASSES =
  "h-4 w-px shrink-0 -skew-x-[18deg] bg-linear-to-b from-transparent via-red to-transparent shadow-[0_0_8px_var(--glow-red)]";

/**
 * What we sell, as a ticker under the hero. Decorative (each of these is said elsewhere on the
 * page: the hero's subtitle, the services, the estimator), so the whole strip is `aria-hidden`.
 *
 * Each group is LEAD, then a separator and an item per item, and ENDS with its own separator
 * and trailing gap — so where one group meets the next there is the same separator and the
 * same spacing as anywhere inside a group, and the loop has no visible seam. Hover pauses it;
 * under reduced motion only the first group is shown, wrapped and centred, with nothing
 * moving.
 *
 * The entrance marker sits on the outer strip: the inner track's CSS animation owns its
 * `transform`.
 */
export function Ticker() {
  const l = useLoc();

  /* The marquee is a transform, so it never repaints — but it is infinite, and an infinite
     transform keeps the compositor awake for the whole visit even with the hero long scrolled
     past. It stops while the strip is out of view, the same way the hero and the directions
     ring already do. The five copies all live on ONE track with ONE animation, so there is no
     seam to desynchronise. */
  const stripRef = useRef<HTMLDivElement>(null);
  useOffscreenAttribute(stripRef);

  return (
    <div
      ref={stripRef}
      data-ticker
      data-intro-reveal="ticker"
      aria-hidden="true"
      className="group/ticker relative flex min-h-(--ticker-h) items-stretch border-y border-glass-line bg-glass-solid [--ticker-gap:28px] md:[--ticker-gap:40px] before:pointer-events-none before:absolute before:inset-x-0 before:-top-px before:z-1 before:h-px before:bg-linear-to-r before:from-transparent before:via-red before:to-transparent before:shadow-[0_0_12px_var(--glow-red)] before:content-['']"
    >
      {/* The edge fade masks this wrapper, not the strip: the glass band stays solid edge to
          edge (a masked band would let the page grid show through its ends) and only the
          moving words dissolve. It cannot sit on the track either — a mask moves with its
          element's transform. Under reduced motion the one static group wraps to fit, so the
          fade is dropped: it would only eat into the first and last words. */}
      <div className="edge-fade-x flex min-w-0 flex-1 items-center overflow-hidden motion-reduce:[mask-image:none]">
        <div
          style={{ "--marquee-copies": TICKER_COPIES } as CSSProperties}
          className="flex w-max animate-marquee will-change-transform group-hover/ticker:[animation-play-state:paused] group-data-offscreen/ticker:[animation-play-state:paused] motion-reduce:w-full motion-reduce:animate-none motion-reduce:justify-center"
        >
          {Array.from({ length: TICKER_COPIES }, (_, copy) => (
            <div
              key={copy}
              data-ticker-group
              className={`flex shrink-0 items-center gap-(--ticker-gap) pr-(--ticker-gap) motion-reduce:shrink motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:gap-x-6 motion-reduce:gap-y-2 motion-reduce:px-(--gutter) motion-reduce:py-3 ${
                copy > 0 ? "motion-reduce:hidden" : ""
              }`}
            >
              <strong className="whitespace-nowrap font-hud text-[clamp(15px,2vw,20px)] font-extrabold leading-[1.3] tracking-[-0.02em] text-txt">
                {l(LEAD)}
              </strong>
              {ITEMS.map((item, i) => (
                <Fragment key={i}>
                  <span data-ticker-sep aria-hidden="true" className={SEP_CLASSES} />
                  <span className="whitespace-nowrap font-hud text-[clamp(13px,1.6vw,17px)] leading-[1.3] tracking-[.02em] text-mut">
                    {l(item)}
                  </span>
                </Fragment>
              ))}
              {/* the seam separator: without it the last item of one group would run straight
                  into the next group's LEAD. Nothing loops under reduced motion, so it goes. */}
              <span
                data-ticker-sep
                aria-hidden="true"
                className={`${SEP_CLASSES} motion-reduce:hidden`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
