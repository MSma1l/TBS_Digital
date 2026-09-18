"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { usePointerTilt } from "@/components/fx/usePointerTilt";
import { HUD_DESKTOP_MEDIA } from "@/lib/hud/gate";
import { selectSceneShape, selectServiceStage } from "@/lib/scene";
import { TILT_MAX } from "@/lib/tilt";
import { useT } from "@/lib/i18n/LanguageProvider";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import { useRequestFlow } from "@/lib/request/RequestFlowProvider";
import { directions } from "@/lib/directions";
import { solutions, solUI, solutionPalette, projectsForSolution } from "@/lib/solutions";
import { useSiteContent, type ProjectItem } from "@/lib/siteContent";
import styles from "./DirectionPage.module.css";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

/* The steps section's corner host is desktop-only, and it is not rendered at all below
   861px rather than hidden with CSS: a host that is in the DOM but measures 0 wide would
   have the scene scale the model down to nothing. Same external-store shape as
   `HudChrome`'s `DesktopOnly`, and the same breakpoint. */
function desktopQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(HUD_DESKTOP_MEDIA);
}
function subscribeDesktop(onChange: () => void): () => void {
  const query = desktopQuery();
  query?.addEventListener?.("change", onChange);
  return () => query?.removeEventListener?.("change", onChange);
}
const isDesktop = () => desktopQuery()?.matches ?? false;
const isDesktopOnServer = () => false;

/** Copy this section owns. Everything else comes from `solUI` / `solutions` — nothing here
 *  is hardcoded in one language (docs/16-i18n-seo.md). */
const pageUI = {
  /* The accessible name of a case toggle is the case's own name; this is the state word a
     screen reader gets after it, and the hint a sighted visitor reads under the name. */
  caseOpen: L("Vezi detaliile", "Смотреть детали", "See the details"),
  caseClose: L("Ascunde detaliile", "Скрыть детали", "Hide the details"),
};

/**
 * A single direction page. Filled directions render the full layout; the rest show a
 * short placeholder until we build them out.
 *
 * This page — not the home-page selector — owns the commercial actions: an action bar
 * directly under the hero with the request flow (carrying this service), the direction's
 * real projects, and the reference project's link when there is one to give.
 *
 * The 3D model: the route wraps this section in the interior stage and hands down `modelArt`,
 * the static drawing of this direction (`app/(site)/servicii/[slug]/page.tsx`). Everything the
 * scene needs from here is the slug — written once into the scene's input store below, where
 * the world reads it every frame and morphs to that direction's model. There is no per-slug
 * branch anywhere in this file: the mapping lives in `lib/scene.ts`. `modelArt` is optional,
 * so the section still renders on its own, with the drawing simply absent.
 *
 * The hero is the model and the copy, nothing else: the reference-project card that used to
 * sit under the model was moved out (2026-09-18). The project it named is the first card of
 * the "Proiecte relevante" grid further down and still carries the action bar's link, and the
 * flow scheme the card drew for a direction with no shipped project moved down beside the
 * "Cum lucrăm" steps, which is what it describes.
 */
export function DirectionPage({ slug, modelArt }: { slug: string; modelArt?: ReactNode }) {
  const t = useT();
  const l = useLoc();
  const { openRequest } = useRequestFlow();
  const { projects } = useSiteContent();
  const sol = solutions[slug];

  /* Which of the five models the scene draws. An unknown slug changes nothing, and the store
     is module-level, so this survives a client navigation between two service pages. */
  useEffect(() => selectSceneShape(slug), [slug]);

  /* ---- the benefit panels: the HUD entrance, then a lean under a mouse ----
     Same vocabulary as the home page's Directions panel (`entry-glow` / `entry-sweep` in
     app/tailwind.css), re-expressed in this module because service pages are CSS Modules.
     The tilt is the site's shared one: fine pointers only, never under reduced motion, and
     it writes transforms — no blur, nothing over the canvas. */
  const tilt = usePointerTilt(TILT_MAX.project);
  const highlightsRef = useRef<HTMLElement | null>(null);
  const desktop = useSyncExternalStore(subscribeDesktop, isDesktop, isDesktopOnServer);

  useEffect(() => {
    const root = highlightsRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const panels = Array.from(root.children).filter(
      (node): node is HTMLElement => node instanceof HTMLElement,
    );
    if (panels.length === 0) return;
    /* One attribute write per panel, once, then the panel is dropped from the observer:
       the edge lights and the sweep plays a single time, and scrolling back changes
       nothing. An attribute, not state — nothing re-renders as the visitor scrolls. */
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).setAttribute("data-entered", "");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.25 },
    );
    for (const panel of panels) observer.observe(panel);
    return () => observer.disconnect();
  }, [slug]);

  /* ---- the cases: opened in place ----
     Open panels are keyed by case name (unique inside a direction), so a re-render — a
     language change, a content refresh — keeps what the visitor opened. */
  const uid = useId();
  const [openCases, setOpenCases] = useState<readonly string[]>([]);
  const toggleCase = useCallback((name: string) => {
    setOpenCases((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  }, []);
  /* A client navigation to another direction reuses this component: nothing stays open from
     the page before. Guarded, so it costs no render on a first mount. */
  useEffect(() => {
    setOpenCases((prev) => (prev.length === 0 ? prev : []));
  }, [slug]);

  /* ---- the steps: which one is being read, and the model's matching moment ---- */
  const stepsRef = useRef<HTMLElement | null>(null);
  const stepRowsRef = useRef<(HTMLElement | null)[]>([]);
  const stepCount = sol?.steps.length ?? 0;

  useEffect(() => {
    const section = stepsRef.current;
    if (!section || stepCount === 0 || typeof IntersectionObserver === "undefined") return;
    const rows = stepRowsRef.current
      .slice(0, stepCount)
      .filter((node): node is HTMLElement => node instanceof HTMLElement);
    if (rows.length === 0) return;

    /* THE READING LINE, at 45% of the viewport: one row is being read, never three.
       The observer's root margin leaves a band 8% of the viewport tall around that line, and
       the row is LIVE while it crosses the band, PAST once it has left it upwards. The band
       has to be thin, and this is the whole reason: the middle THIRD of a 800px viewport is
       266px, and a three-step section is shorter than that, so a middle-third band holds all
       three rows at once — every number lit, and the model with no single stage to hold. The
       rows are also spaced so that one is on the line at a time (DirectionPage.module.css).
       Root margin, not a scroll handler: nothing here runs while the section is off screen. */
    const READING_LINE = 0.45;
    const inBand = new Set<number>();
    let reported = -1;

    /* Two rows can touch the band at a boundary; the one whose middle is nearest the reading
       line is the one being read. Measured in the observer's callback — on a crossing, never
       per scrolled frame. */
    const pick = (): number => {
      if (inBand.size === 0) return -1;
      const line = window.innerHeight * READING_LINE;
      let best = -1;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const index of inBand) {
        const rect = rows[index].getBoundingClientRect();
        const distance = Math.abs((rect.top + rect.bottom) / 2 - line);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      }
      return best;
    };

    const apply = () => {
      const current = pick();
      /* With no row on the line the section is either still coming (nothing read) or already
         above it (all of it read). Asked of the section itself rather than remembered from
         the rows: an observer is silent about a row whose state did not CHANGE, so a set of
         "rows seen going up" keeps saying `past` long after the visitor scrolled back. */
      const allPast =
        current < 0 && section.getBoundingClientRect().top < window.innerHeight * READING_LINE;
      for (let i = 0; i < rows.length; i += 1) {
        rows[i].dataset.state =
          current >= 0
            ? i === current
              ? "live"
              : i < current
                ? "past"
                : "ahead"
            : allPast
              ? "past"
              : "ahead";
      }
      /* The fallback fill for an engine without `animation-timeline: view()`: the steps
         already read, out of all of them. Written on the section, never on html or body. */
      const done = current >= 0 ? current + 1 : allPast ? rows.length : 0;
      section.style.setProperty("--steps-progress", String(Math.min(1, done / rows.length)));
      /* The point of the whole feature: the world holds the model on this step's moment.
         Once per change of value — never once per intersection callback. */
      if (current !== reported) {
        reported = current;
        selectServiceStage(current);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = rows.indexOf(entry.target as HTMLElement);
          if (index < 0) continue;
          if (entry.isIntersecting) inBand.add(index);
          else inBand.delete(index);
        }
        apply();
      },
      /* The band: 41% → 49% of the viewport, i.e. 8% of it centred on the reading line. */
      { rootMargin: "-41% 0px -51% 0px", threshold: 0 },
    );
    for (const row of rows) observer.observe(row);

    return () => {
      observer.disconnect();
      section.style.removeProperty("--steps-progress");
      /* Leaving the page releases the model: no page holds a stage it is not showing. */
      selectServiceStage(-1);
    };
  }, [slug, stepCount]);

  /* Real portfolio entries for this direction, in the curated order from lib/solutions.ts.
     Empty for a direction we have not shipped work on yet — the projects section and the
     action that scrolls to it then do not render at all, rather than pointing at nothing. */
  const related = projectsForSolution<ProjectItem>(slug, projects);
  const reference = related[0];
  const palette = solutionPalette[slug];

  if (!sol) {
    const dir = directions.find((d) => d.slug === slug);
    return (
      <section className={`section ${styles.placeholder}`}>
        <div className="container">
          <div className={`mono ${styles.eyebrow}`}>{t("dir.section.kicker")}</div>
          <h1 className={styles.phTitle}>{dir ? t(dir.labelKey) : ""}</h1>
          <p className={styles.phLead}>{t("dir.page.soon")}</p>
          <Link href="/#servicii" className={`mono ${styles.back}`}>
            ← {t("dir.page.back")}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div
      className={styles.page}
      style={
        {
          "--sol-accent": sol.accent ?? "var(--blue)",
          "--sol-p1": palette?.p1,
          "--sol-p2": palette?.p2,
        } as CSSProperties
      }
    >
      <div className="container">
        <Link href="/#servicii" className={`mono ${styles.back}`}>
          {l(solUI.back)}
        </Link>

        <section className={styles.hero}>
          <div>
            <div className={`mono ${styles.eyebrow}`}>{l(sol.eyebrow)}</div>
            <h1 className={styles.title}>{l(sol.title)}</h1>
            <p className={styles.intro}>{l(sol.intro)}</p>
          </div>

          {/* The model's host, and the whole of the hero's right column since the reference
              card moved out. A transparent slot: the canvas is not in here — it draws on the
              stage's sticky layer and is aimed at this box, which the director measures by its
              `data-scene-anchor`, so the host must keep a real width. Decorative and
              heading-less: nothing focusable, and no section marker for the HUD rail. */}
          <div className={styles.modelHost} data-scene-anchor="services" aria-hidden="true">
            {modelArt}
          </div>
        </section>

        {/* ---- action bar: everything the visitor can DO with this service ---- */}
        <div className={styles.actions}>
          {/* Opens the real request flow in the site's one dialog, with this service
              preselected, so the visitor is not thrown back to the home page mid-read. */}
          <button
            type="button"
            className={styles.cta}
            onClick={() => openRequest({ serviceSlug: slug, source: "service-page" })}
          >
            {l(solUI.actionTalk)}
          </button>

          {related.length > 0 && (
            <a href="#proiecte" className={styles.ghost}>
              {l(solUI.actionProjects)}
            </a>
          )}

          {reference &&
            (reference.url ? (
              <a
                href={reference.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.textLink}
              >
                {l(solUI.actionProject)}
              </a>
            ) : (
              /* A private client system has no public URL — it is stated as text, never
                 rendered as a link that goes nowhere. */
              <span className={styles.noLink}>
                {reference.name} — {l(solUI.actionProjectPrivate)}
              </span>
            ))}
        </div>

        {/* The HUD panels: the edge lights and one band of light crosses each panel the first
            time it is seen (`data-entered`, set once by an observer), and a mouse leans it. */}
        <section className={styles.highlights} ref={highlightsRef}>
          {sol.items.map((it, i) => (
            <article
              key={i}
              className={styles.highlight}
              style={{ "--entry-delay": `${i * 90}ms` } as CSSProperties}
              data-tilt={tilt.enabled ? "on" : "off"}
              {...tilt.handlers}
            >
              <b className="mono">{l(solUI.benefit)}</b>
              <h2>{l(it.title)}</h2>
              <p>{l(it.desc)}</p>
            </article>
          ))}
        </section>

        {/* ---- labelled cases ----
            Each one is a piece of work that really exists, described with what it actually
            does. A case gets a link only when there is a public page behind it; our own
            internal flow has none, so it is named as ours and left without one.

            The name is the toggle: a real button inside the heading, so its accessible name
            is the case's own name, with `aria-expanded` for the state and `aria-controls`
            for the panel it opens. The panel is in the DOM either way — collapsed it is
            `inert`, so its link never becomes an invisible tab stop. */}
        {sol.cases && (
          <section className={styles.cases}>
            <div className={styles.casesTop}>
              <h2 className="disp">{l(sol.cases.title)}</h2>
              <p>{l(sol.cases.lead)}</p>
            </div>
            <div className={styles.caseGrid}>
              {sol.cases.items.map((c, i) => {
                const open = openCases.includes(c.name);
                const panelId = `${uid}-case-${i}`;
                return (
                  <article key={c.name} className={styles.caseCard} data-open={open ? "" : undefined}>
                    <b className={`mono ${styles.caseLabel}`}>{l(c.label)}</b>
                    <h3 className={`disp ${styles.caseName}`}>
                      <button
                        type="button"
                        className={styles.caseToggle}
                        aria-expanded={open}
                        aria-controls={panelId}
                        onClick={() => toggleCase(c.name)}
                      >
                        {c.name}
                      </button>
                    </h3>
                    <span aria-hidden="true" className={`mono ${styles.caseHint}`}>
                      {open ? l(pageUI.caseClose) : l(pageUI.caseOpen)}
                    </span>
                    <div id={panelId} className={styles.casePanel} inert={!open}>
                      <div className={styles.casePanelInner}>
                        <p className={styles.caseText}>{l(c.text)}</p>
                        {c.url ? (
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.caseLink}
                          >
                            {l(solUI.caseLink)}
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {related.length > 0 && (
          <section id="proiecte" className={styles.projects}>
            <div className={styles.projectsTop}>
              <h2 className="disp">{l(solUI.projectsTitle)}</h2>
              <p>{l(solUI.projectsLead)}</p>
            </div>
            <div className={styles.projectGrid}>
              {related.map((p) => {
                const inner = (
                  <>
                    {p.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.images[0]}
                        alt={p.name}
                        loading="lazy"
                        decoding="async"
                        className={styles.projectImage}
                      />
                    ) : null}
                    <small className={`mono ${styles.projectTag}`}>{l(p.tag)}</small>
                    <h3 className={`disp ${styles.projectName}`}>{p.name}</h3>
                    <p className={styles.projectDesc}>{l(p.desc)}</p>
                  </>
                );
                /* Same rule as the /04 grid: only a project with a real link becomes an
                   <a>; the rest are plain articles. */
                return p.url ? (
                  <a
                    key={p.id}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.project}
                  >
                    {inner}
                  </a>
                ) : (
                  <article key={p.id} className={styles.project}>
                    {inner}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* The Ghid TBS topic of a service page (components/hud/guide): lingering here offers the
            guide, which opens the request flow with this service.

            The rail on the left fills as the section is read, the number of the step in the
            middle third of the viewport lights, and the same index is handed to the scene, so
            the model in the hero holds on that step's moment. */}
        <section className={styles.steps} data-guide-topic="service" ref={stepsRef}>
          {/* The painted card. The section itself carries no background at all: the scene's
              canvas draws BEHIND the page, so anything opaque over the corner host hides the
              model that is aimed at it. Everything the card is — the ink surface, the radius,
              the 36px padding, the white copy — lives on this wrapper, which covers the copy
              column only; the host's column beside it stays transparent, and the model shows
              through the page. Below 861px, and on every renderer but WebGL, the wrapper is
              the section's only child and fills it edge to edge, exactly as before. */}
          <div className={styles.stepsCard}>
            <h2 className="disp">{l(solUI.stepsTitle)}</h2>
            <div className={styles.stepsBody} data-flow={sol.flow?.length ? "on" : undefined}>
              <div className={styles.stepsList}>
                <span aria-hidden="true" className={styles.stepsTrack}>
                  <span className={styles.stepsFill} />
                </span>
                {sol.steps.map((st, i) => (
                  <div
                    key={i}
                    className={styles.stepRow}
                    data-state="ahead"
                    ref={(node) => {
                      stepRowsRef.current[i] = node;
                    }}
                  >
                    <b className="mono">{String(i + 1).padStart(2, "0")}</b>
                    <p>{l(st)}</p>
                  </div>
                ))}
              </div>

              {/* A direction sold as a capability has no delivered project, and the scheme of
                  the flow we build is what it shows instead. It used to be drawn in the hero
                  card, under the model; it belongs here, beside the steps that deliver it. */}
              {sol.flow?.length ? (
                <aside className={styles.flowAside}>
                  <div className={`mono ${styles.flowLabel}`}>{l(sol.cardLabel)}</div>
                  <strong className={`disp ${styles.flowTitle}`}>{l(sol.cardTitle)}</strong>
                  <p className={styles.flowText}>{l(sol.cardText)}</p>
                  <ol className={styles.flow}>
                    {sol.flow.map((step, i) => (
                      <li key={i}>
                        <b className="mono">{String(i + 1).padStart(2, "0")}</b>
                        <span>{l(step)}</span>
                      </li>
                    ))}
                  </ol>
                </aside>
              ) : null}
            </div>
          </div>

          {/* The model's second home. The steps are ~1000px below the hero, so the model the
              active step drives is off the top of the screen while they are read; this is the
              corner it appears in for the length of the section (the scene fits it into this
              box and takes it back to the hero once the section is past). Sticky INSIDE the
              section — nothing is written onto html or body, and no ancestor takes a
              transform, a filter, `contain` or a clipping overflow, which would break both
              this sticky and the stage's own (docs/07-conventions.md).
              Empty, decorative and heading-less: no marker for the fibre rail, nothing
              focusable, and no pointer target. Desktop only: below 861px it is not in the DOM
              at all, so the scene can never measure a zero-wide host. */}
          {desktop ? (
            <div className={styles.stepsModelHost} data-scene-anchor="steps" aria-hidden="true" />
          ) : null}
        </section>

        <section className={styles.bottom}>
          <h2 className="disp">{l(solUI.bottomTitle)}</h2>
          <p>{l(solUI.bottomLead)}</p>
          <button
            type="button"
            className={styles.cta}
            onClick={() => openRequest({ serviceSlug: slug, source: "service-page-bottom" })}
          >
            {l(solUI.start)}
          </button>
        </section>
      </div>
    </div>
  );
}
