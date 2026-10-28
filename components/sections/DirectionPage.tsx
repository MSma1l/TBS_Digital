"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { usePointerTilt } from "@/components/fx/usePointerTilt";
import { TILT_MAX } from "@/lib/tilt";
import { useT } from "@/lib/i18n/LanguageProvider";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import { useRequestFlow } from "@/lib/request/RequestFlowProvider";
import { directions } from "@/lib/directions";
import {
  directionPrice,
  solutions,
  solUI,
  solutionPalette,
  projectsForSolution,
} from "@/lib/solutions";
import { useSiteContent, type ProjectItem } from "@/lib/siteContent";
import styles from "./DirectionPage.module.css";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

/** Copy this section owns. Everything else comes from `solUI` / `solutions` — nothing here
 *  is hardcoded in one language (docs/16-i18n-seo.md). */
const pageUI = {
  /* The accessible name of a case toggle is the case's own name; this is the state word a
     screen reader gets after it, and the hint a sighted visitor reads under the name. */
  caseOpen: L("Vezi detaliile", "Смотреть детали", "See the details"),
  caseClose: L("Ascunde detaliile", "Скрыть детали", "Hide the details"),
};

/** One frozen empty set, so "nothing is open" is the same value at every render. */
const NO_CASES: readonly string[] = Object.freeze([]);

/**
 * A single direction page. Filled directions render the full layout; the rest show a
 * short placeholder until we build them out.
 *
 * This page — not the home-page selector — owns the commercial actions: an action bar
 * directly under the hero with the request flow (carrying this service), the direction's
 * real projects, and the reference project's link when there is one to give.
 *
 * The hero's drawing: the route hands down `modelArt`, the static illustration of this
 * direction (`app/(site)/servicii/[slug]/page.tsx`, components/art/ServiceArt). It is optional,
 * so the section still renders on its own, with the drawing simply absent.
 *
 * The hero is the model and the copy, nothing else — the title, then the direction's pitch and
 * the price it starts at, the same words and figure as its panel on the home page
 * (`lib/solutions.ts`). The reference-project card that used to sit under the model was moved
 * out (2026-09-18): the project it named is the first card of the "Proiecte relevante" grid
 * further down and still carries the action bar's link, and the flow scheme the card drew for a
 * direction with no shipped project moved down beside the "Cum lucrăm" steps, which is what it
 * describes.
 */
export function DirectionPage({ slug, modelArt }: { slug: string; modelArt?: ReactNode }) {
  const t = useT();
  const l = useLoc();
  const { openRequest } = useRequestFlow();
  const { projects, services } = useSiteContent();
  const sol = solutions[slug];
  /* The admin's figure, as the request dialog will quote it; "" where there is none to show
     (Brand & UI has no service of its own). */
  const price = directionPrice(slug, services, l);

  /* ---- the benefit panels: the HUD entrance, then a lean under a mouse ----
     Same vocabulary as the home page's Directions panel (`entry-glow` / `entry-sweep` in
     app/tailwind.css), re-expressed in this module because service pages are CSS Modules.
     The tilt is the site's shared one: fine pointers only, never under reduced motion, and
     it writes transforms — no blur. */
  const tilt = usePointerTilt(TILT_MAX.project);
  const highlightsRef = useRef<HTMLElement | null>(null);
  const projectsRef = useRef<HTMLDivElement | null>(null);

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
     language change, a content refresh — keeps what the visitor opened.

     …and the SET is keyed by the direction it was opened on. A client navigation to another
     service reuses this component, and nothing may stay open from the page before. Read back to
     empty DURING RENDER for a slug the state does not belong to, never cleared in an effect: an
     effect would paint the new direction once with the previous one's panels open and then close
     them a render later, which is the flash this shape exists to avoid. */
  const uid = useId();
  const [openCases, setOpenCases] = useState<{ slug: string; names: readonly string[] }>({
    slug,
    names: NO_CASES,
  });
  const openNames = openCases.slug === slug ? openCases.names : NO_CASES;
  const toggleCase = useCallback((name: string) => {
    setOpenCases((prev) => {
      const names = prev.slug === slug ? prev.names : NO_CASES;
      return {
        slug,
        names: names.includes(name) ? names.filter((n) => n !== name) : [...names, name],
      };
    });
  }, [slug]);

  /* ---- the steps: which one is being read ---- */
  const stepsRef = useRef<HTMLElement | null>(null);

  /*
   * THE BLOCK LIGHTS ONCE, WHEN IT IS REACHED.
   *
   * `data-armed` at mount holds the panels in their withheld pose — written from an effect, so a
   * visitor whose JavaScript never arrives sees the finished block rather than three empty
   * outlines. `data-entered` is a latch: the observer unobserves itself, so scrolling back up and
   * down again does not replay it. Same shape as the footer's ignition.
   */
  useEffect(() => {
    const section = stepsRef.current;
    if (!section) return;
    section.setAttribute("data-armed", "");
    if (typeof IntersectionObserver === "undefined") {
      section.setAttribute("data-entered", "");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-entered", "");
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.25 },
    );
    io.observe(section);
    return () => io.disconnect();
  }, []);
  const stepRowsRef = useRef<(HTMLElement | null)[]>([]);
  const stepCount = sol?.steps.length ?? 0;

  useEffect(() => {
    const section = stepsRef.current;
    if (!section || stepCount === 0 || typeof IntersectionObserver === "undefined") return;
    const rows = stepRowsRef.current
      .slice(0, stepCount + 1)
      .filter((node): node is HTMLElement => node instanceof HTMLElement);
    if (rows.length === 0) return;

    /*
     * THE READING LINE, at 45% of the viewport — and the state is COUNTED from it, not read off
     * what happens to be inside the observer's band.
     *
     * The band only says WHEN to look. What the block shows is derived from positions every time
     * it does: how many marks have already crossed the line. That matters because between two
     * marks nothing is in the band at all, and the old code read that emptiness as "the whole
     * block is behind us" — so the lighting went 1 → done → 2 → done → 3, which is exactly the
     * flicker that was reported. Counting cannot do that: it only ever goes up as you scroll down
     * and back down as you scroll up.
     *
     * There is one mark more than there are steps. The extra one sits at the section's tail, and
     * its crossing is what "done" means: the block is genuinely behind the reading line, rather
     * than merely between two of its own steps.
     *
     * Root margin, not a scroll handler: nothing here runs while the section is off screen.
     */
    const READING_LINE = 0.45;

    const apply = () => {
      const line = window.innerHeight * READING_LINE;
      const crossed = rows.map((row) => row.getBoundingClientRect().top < line);
      /* The tail mark is the last one; the steps are the ones before it. */
      const ended = crossed[stepCount] === true;
      let doneCount = 0;
      for (let i = 0; i < stepCount; i += 1) if (crossed[i]) doneCount += 1;
      const current = ended ? -1 : doneCount - 1;

      for (let i = 0; i < rows.length; i += 1) {
        rows[i].dataset.state = ended ? "past" : i < doneCount ? (i === current ? "live" : "past") : "ahead";
      }
      /* The fallback fill for an engine without `animation-timeline: view()`: the steps already
         read, out of all of them. Written on the section, never on html or body. */
      section.style.setProperty("--steps-progress", String(Math.min(1, doneCount / stepCount)));
      /*
       * Which step is being read, as an attribute the stylesheet selects on — and `done` once the
       * section is behind the reading line.
       *
       * It used to write the step COUNT there, so after the block had been read the last panel
       * stayed lit for the whole rest of the page: not "the third step is happening now" but a box
       * stuck on. `done` lets the stylesheet say the true thing — all of them carried out, none
       * live.
       */
      section.dataset.active = ended ? "done" : String(doneCount);
    };

    const observer = new IntersectionObserver(
      /* Every callback asks the same question again, from positions — so it does not matter which
         mark moved, only that one did. */
      apply,
      /*
       * The root is everything ABOVE the reading line: the viewport with its bottom 55% cut off.
       * A mark entering it has crossed the line; leaving it upwards, at the top of the screen,
       * changes nothing, because `apply` reads positions rather than this set.
       *
       * It used to be a band 8% of the viewport tall AROUND the line, and that was the flaw: a
       * fast flick can carry a mark clean through a 72px band between two frames, and an observer
       * that was outside before and outside after says nothing at all. A region 45% of the
       * viewport tall cannot be jumped that way — once a mark is in it, it stays in.
       */
      { rootMargin: "0px 0px -55% 0px", threshold: 0 },
    );
    for (const row of rows) observer.observe(row);

    return () => {
      observer.disconnect();
      section.style.removeProperty("--steps-progress");
      delete section.dataset.active;
    };
  }, [slug, stepCount]);

  /* Real portfolio entries for this direction, in the curated order from lib/solutions.ts.
     Empty for a direction we have not shipped work on yet — the projects section and the
     action that scrolls to it then do not render at all, rather than pointing at nothing. */
  const related = projectsForSolution<ProjectItem>(slug, projects);
  const reference = related[0];
  const palette = solutionPalette[slug];

  /* ---- the projects grid: the shelf's frame, then the windows folding open ----
     Exactly the shape of the panels' observer above: one attribute write per element, once,
     then it is dropped from the observer. The grid itself is observed alongside its cards —
     it is what draws the frame — and an element that already carries the mark is skipped, so
     a content swap can only ever add to the sequence, never replay it.

     Keyed on the joined ids, not on `related.length`: `useSiteContent` renders the default
     document on the server and the first paint, then swaps in the localStorage cache and then
     the API document (lib/siteContent.tsx:168-206). A swap that changes WHICH projects are in
     the grid without changing the count would otherwise leave the new cards unobserved and
     folded shut for good. A language change does not replay anything: the cards are keyed by
     `p.id`, React reuses the nodes and `data-entered` stays put.

     An attribute, not state — nothing re-renders as the visitor scrolls, and this effect adds
     no `react-hooks/set-state-in-effect`, and no effect in this file does any more. */
  const relatedKey = related.map((p) => p.id).join("|");
  useEffect(() => {
    const root = projectsRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    /* What is WATCHED and what is OPENED are not always the same element. The grid's own frame
       opens when `.projectsReel` — the box around it — arrives, because where the cards run
       sideways on a phone the grid is four screens wide: a threshold measured as a SHARE of the
       target can never be met by a target that long, and the frame would stay dark for good. The
       wrapper is the box the visitor actually has on screen, at every width. */
    const opens = new Map<Element, HTMLElement>();
    const watch = (target: HTMLElement | null, opened: HTMLElement | null = target) => {
      if (target && opened && !opened.hasAttribute("data-entered")) opens.set(target, opened);
    };
    watch(root.parentElement instanceof HTMLElement ? root.parentElement : root, root);
    for (const card of Array.from(root.children)) {
      watch(card instanceof HTMLElement ? card : null);
    }
    if (opens.size === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          opens.get(entry.target)?.setAttribute("data-entered", "");
          observer.unobserve(entry.target);
        }
      },
      /* The bottom margin means a window opens once it is properly on screen rather than as
         its first pixel crosses the fold — the action bar's "Vezi proiectele relevante"
         lands straight here (:301-305), and the row should still have its gesture left. */
      { threshold: 0.25, rootMargin: "0px 0px -10% 0px" },
    );
    for (const target of opens.keys()) observer.observe(target);
    return () => observer.disconnect();
  }, [slug, relatedKey]);

  if (!sol) {
    const dir = directions.find((d) => d.slug === slug);
    return (
      <section className={`section ${styles.placeholder}`}>
        <div className="container">
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
            <h1 className={styles.title}>{l(sol.title)}</h1>
            {/* Two paragraphs, not a <strong> run into the text: a screen reader would read the
                promise and its first sentence as one. Not a heading either — it introduces the
                page rather than a section of it. */}
            <p className={styles.leadTitle}>{l(sol.pitch.title)}</p>
            <p className={styles.lead}>{l(sol.pitch.text)}</p>
            {price ? <p className={styles.price}>{price}</p> : null}
          </div>

          {/* The drawing's host, and the whole of the hero's right column since the reference
              card moved out. Decorative and heading-less: nothing focusable, and no section
              marker for the HUD rail. */}
          <div className={styles.modelHost} aria-hidden="true">
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

        {/* The HUD panels. The three benefits of a direction are a sequence — clarify, build,
            launch — so the row is built to read as one: a pulse enters the first panel's
            circuit, crosses it, and each panel in turn lights, draws its corner brackets and
            fires its node as the pulse reaches it. `--panel-index` is the only thing the
            markup has to say about that; every delay is derived from it in CSS, so the
            stacked layout can flatten the whole sequence with one rule.
            Everything added here is decoration: shapes, light and motion, no numbers about
            the business. Every span below is `aria-hidden` and carries no copy. */}
        <section className={styles.highlights} ref={highlightsRef}>
          {sol.items.map((it, i) => (
            <article
              key={i}
              className={styles.highlight}
              style={{ "--panel-index": i } as CSSProperties}
              data-tilt={tilt.enabled ? "on" : "off"}
              {...tilt.handlers}
            >
              {/* The painted part of the panel: `--panel`, the padding and the copy. The article
                  keeps the border, the radius and the entrance glow. */}
              <div className={styles.hlBody}>
                {/* The circuit the pulse travels, and the node it ends in. Both pulses live on
                    this span's two pseudo-elements — the entrance on one, the hover replay on
                    the other — so a replay can never restart the entrance. */}
                <span aria-hidden="true" className={styles.hlCircuit} />
                <span aria-hidden="true" className={styles.hlNode} />
                <span aria-hidden="true" className={styles.hlCorner} data-corner="tl" />
                <span aria-hidden="true" className={styles.hlCorner} data-corner="br" />
                {/* The ghost index. It used to fill the reserved bottom strip; that strip is
                    the window now, so it moved up to the panel's own top-right corner —
                    opposite the label, above the first line of the title, over the panel's
                    own background and never behind a word of copy. */}
                <span aria-hidden="true" className={`mono ${styles.hlIndex}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2>{l(it.title)}</h2>
                <p>{l(it.desc)}</p>
              </div>
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
                const open = openNames.includes(c.name);
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
            </div>

            {/* On a phone the cards run sideways instead of stacking (max-width: 760px in
                the module). The strip has to CLIP to scroll, and the shelf's frame hangs 6px
                outside the grid on its own pseudo-elements — so the scroll box is this wrapper
                and the grid keeps its frame, whole, inside it. Above that width it is a plain
                block that changes nothing, and the grid is the same shelf it has always been.
                It is also the box the arrival observer watches (:328) — see why there. */}
            <div className={styles.projectsReel}>
              <div
                className={styles.projectGrid}
                ref={projectsRef}
                style={{ "--card-count": related.length } as CSSProperties}
              >
                {related.map((p, i) => {
                  const image = p.images?.[0];
                  const glass = image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image}
                      alt={p.name}
                      loading="lazy"
                      decoding="async"
                      className={styles.projImage}
                    />
                  ) : null;
                  const inner = (
                    <>
                      {/* The window. The project's own tag becomes its title bar and the
                          screenshot its glass — the capture lives INSIDE the frame, it never
                          gets a frame drawn over it, and it is only ever made smaller: the
                          28px bar and the 1px ring come out of the card's existing inner
                          width (docs/05-page-sections.md:437-441).
                          Two spans, never divs, because the card is sometimes an <a> — and
                          nothing added here is an <a>, an <article> or an <h3>, all three of
                          which components/__tests__/direction-page.test.tsx counts inside
                          #proiecte. A document with no image for a project still has to
                          render, so the tag keeps its old standalone form in that branch. */}
                      {glass ? (
                        <span className={styles.projLid}>
                          <span className={styles.projShell}>
                            <small className={`mono ${styles.projTag}`}>{l(p.tag)}</small>
                            {glass}
                          </span>
                        </span>
                      ) : (
                        <small className={`mono ${styles.projTag} ${styles.projTagLoose}`}>
                          {l(p.tag)}
                        </small>
                      )}
                      <h3 className={`disp ${styles.projectName}`}>{p.name}</h3>
                      <p className={styles.projectDesc}>{l(p.desc)}</p>
                    </>
                  );
                  /* Same rule as the /04 grid: only a project with a real link becomes an
                     <a>; the rest are plain articles. Both kinds get `--card-index` (their
                     place in the fold) and the pointer lean — on a direction where no project
                     has a public link, nothing in this section moved at all until now — but
                     only the <a> lifts and takes the accent border, because that pair is the
                     link's affordance and these cards go nowhere (lib/content.ts:170-172). */
                  return p.url ? (
                    <a
                      key={p.id}
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.project}
                      style={{ "--card-index": i } as CSSProperties}
                      data-tilt={tilt.enabled ? "on" : "off"}
                      {...tilt.handlers}
                    >
                      {inner}
                    </a>
                  ) : (
                    <article
                      key={p.id}
                      className={styles.project}
                      style={{ "--card-index": i } as CSSProperties}
                      data-tilt={tilt.enabled ? "on" : "off"}
                      {...tilt.handlers}
                    >
                      {inner}
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* The rail on the left fills as the section is read, and the number of the step in
            the middle third of the viewport lights. */}
        <section className={styles.steps} ref={stepsRef}>
          {/*
            * THE READING MARKS, and they are why the panels can sit side by side.
            *
            * The step being read is decided by an observer holding a line at 45% of the viewport,
            * which only works on things that cross it ONE AT A TIME — three panels abreast cross
            * it on the same frame. So the observer watches these instead: 1px marks in the steps'
            * order, and the panels light off `data-active`, which the same observer writes.
            *
            * They are spread over the whole SECTION, not over the card's list. Inside the list
            * they came out 73px apart while the observer's band is 72px tall, so the three states
            * were handed over inside 177px of scroll — under two notches of a wheel, which is what
            * made the lighting look like a fault. Over the section they are ~157px apart.
            *
            * Empty, absolutely placed and hidden from assistive tech: they carry no copy, and
            * nothing moves for them.
            */}
          {Array.from({ length: sol.steps.length + 1 }, (_, i) => (
            <span
              key={`mark-${i}`}
              aria-hidden="true"
              className={styles.stepMark}
              style={{ "--m": i, "--n": sol.steps.length } as CSSProperties}
              data-state="ahead"
              ref={(node) => {
                stepRowsRef.current[i] = node;
              }}
            />
          ))}
          {/* The painted card: the ink surface, the radius, the 36px padding, the white copy. */}
          <div className={styles.stepsCard}>
            <h2 className="disp">{l(solUI.stepsTitle)}</h2>
            <div className={styles.stepsBody} data-flow={sol.flow?.length ? "on" : undefined}>
              <div className={styles.stepsList}>
                <span aria-hidden="true" className={styles.stepsTrack}>
                  <span className={styles.stepsFill} />
                  {/* The head of the fill: a light that slides along the spine to the step being
                      read. It is not a loop — its position IS `--steps-progress`, so it can only
                      ever be where the reading is. */}
                  <span className={styles.stepsSpark} />
                </span>

                {sol.steps.map((st, i) => (
                  <div key={i} className={styles.stepRow} style={{ "--s": i } as CSSProperties}>
                    {/* The index, twice: once as the panel's label and once enormous behind it.
                        Same number, no new copy — the big one is what gives a three-sentence
                        block something to look at. */}
                    <b className="mono">{String(i + 1).padStart(2, "0")}</b>
                    <span aria-hidden="true" className={`disp ${styles.stepBig}`}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <p>{l(st)}</p>
                  </div>
                ))}
              </div>

              {/* A direction sold as a capability has no delivered project, and the scheme of
                  the flow we build is what it shows instead. It used to be drawn in the hero
                  card, under the model; it belongs here, beside the steps that deliver it. */}
              {sol.flow?.length ? (
                <aside className={styles.flowAside}>
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
        </section>

        <section className={styles.bottom}>
          {/* The close was a heading, a line and a button floating in the page's own dark. It is
              a panel now, in the HUD's own language: a thread across the top and four corner
              brackets. Decoration only — nothing here is read, focusable or clickable. */}
          <span className={styles.bottomFrame} aria-hidden="true">
            <span className={styles.bottomThread} />
          </span>
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
