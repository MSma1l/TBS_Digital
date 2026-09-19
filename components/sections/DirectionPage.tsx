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
import {
  LAPTOP_BOOT,
  LAPTOP_BOOT_GATE,
  laptopScreenBox,
  type ScreenBox,
} from "@/components/scene/choreography";
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
  /* ---- the projects reel: the shape "Proiecte relevante" takes where the 3D laptop is live ---- */
  /* The heading of the list that stands in for the machine wherever a picture cannot be seen —
     assistive technology, a search engine, a text browser. It is the section's alt text. */
  reelListTitle: L(
    "Proiectele care rulează pe ecran",
    "Проекты, которые идут на экране",
    "The projects playing on the screen",
  ),
};

/**
 * Milliseconds one project holds the laptop's display before the reel moves on.
 *
 * It runs only while the stage is on screen, and it stops under the pointer or a focus inside the
 * stage — that pause is the mechanism WCAG 2.2.2 asks for (auto-updating information, presented in
 * parallel with other content, needs a way to pause or stop it), reachable with a pointer by
 * moving onto the machine and from the keyboard by focusing the screen's own link.
 */
const PROJECT_DWELL_MS = 2000;

/**
 * …and the machine boots before any of that. The reel is held for the arrival plus one full dwell,
 * so the project the boot lands on is read for as long as every other one rather than being swept
 * away a moment after it arrives. Both numbers come from the scene's own table — the sequence and
 * the page cannot drift apart.
 */
const PROJECT_BOOT_HOLD_MS = LAPTOP_BOOT.swap * 1000 + PROJECT_DWELL_MS;

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
  const projectsRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const screenRef = useRef<HTMLDivElement | null>(null);
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
     no second `react-hooks/set-state-in-effect` on top of the one already at :131. */
  const relatedKey = related.map((p) => p.id).join("|");
  useEffect(() => {
    const root = projectsRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    // The stage rides the same observer: whichever of the two shapes the page laid out is the one
    // that ever intersects, so each gets its entrance exactly once and the other costs nothing.
    const targets = [stageRef.current, root, ...Array.from(root.children)].filter(
      (node): node is HTMLElement =>
        node instanceof HTMLElement && !node.hasAttribute("data-entered"),
    );
    if (targets.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).setAttribute("data-entered", "");
          observer.unobserve(entry.target);
        }
      },
      /* The bottom margin means a window opens once it is properly on screen rather than as
         its first pixel crosses the fold — the action bar's "Vezi proiectele relevante"
         lands straight here (:301-305), and the row should still have its gesture left. */
      { threshold: 0.25, rootMargin: "0px 0px -10% 0px" },
    );
    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, [slug, relatedKey]);

  /* ---- the reel: which project is on the laptop's display ----
     The page owns this number, not the scene. It picks the card the hologram is composed from
     (`data-project-index` on the grid, read by components/scene/projectsReel.ts) and the project
     the screen's own link opens. The machine runs on its own and there is nothing to press to
     change it — that is the whole design now, and the list below the stage is what carries the
     same projects for anyone who cannot see a picture.

     `active` may outrun the list (a content swap can shorten it), so the index the page uses is
     derived and clamped rather than corrected in an effect. */
  const [active, setActive] = useState(0);
  /* The pointer is over the stage, or the focus is inside it: the reel is paused while it is.
     That IS the mechanism WCAG 2.2.2 asks for — auto-updating content that starts by itself and
     runs beside other content needs a way to pause or stop it. It is reachable both ways: with a
     pointer by moving onto the machine, and from the keyboard by focusing the screen's own link,
     which is the first thing Tab reaches in this section. */
  const [reelHeld, setReelHeld] = useState(false);
  /* The stage is on screen, by the very share that arms the machine's arrival in the scene
     (`LAPTOP_BOOT_GATE.on`) — one number, so the boot and the reel start on the same beat and the
     sequence lands on the FIRST project rather than on whichever one the clock had reached. It
     never becomes true where the stage is not laid out (below 861px, `fallback`, `off`, reduced
     motion), so no timer runs for a visitor who is reading the grid. */
  const [reelOnScreen, setReelOnScreen] = useState(false);
  /* …and the machine has finished booting. */
  const [booted, setBooted] = useState(false);
  /* Where the display lands inside the window, so the thing a visitor presses sits on the screen
     they are looking at. Measured off the window itself and put through the same arithmetic the
     scene fits the machine with (components/scene/choreography.ts), so the two cannot drift. */
  const [screenBox, setScreenBox] = useState<ScreenBox | null>(null);
  const reelCount = related.length;
  const reelIndex = reelCount > 0 ? Math.min(active, reelCount - 1) : 0;
  const onScreenProject = related[reelIndex];

  /* A different direction is a different set of projects. Guarded, so it costs no render on a
     first mount (the same shape as the open-cases reset above). */
  useEffect(() => {
    setActive((current) => (current === 0 ? current : 0));
  }, [slug]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) =>
        setReelOnScreen(entries.some((entry) => entry.intersectionRatio >= LAPTOP_BOOT_GATE.on)),
      { threshold: LAPTOP_BOOT_GATE.on },
    );
    observer.observe(stage);
    return () => observer.disconnect();
  }, [slug]);

  /* Arriving at the section puts the reel back to the first project and holds it there while the
     machine boots. Leaving stows both. Guarded, so neither costs a render on a first mount. */
  useEffect(() => {
    if (!reelOnScreen) {
      setBooted((done) => (done ? false : done));
      return;
    }
    setActive((current) => (current === 0 ? current : 0));
    const id = window.setTimeout(() => setBooted(true), PROJECT_BOOT_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [reelOnScreen]);

  useEffect(() => {
    if (!booted || reelHeld || !reelOnScreen || reelCount < 2) return;
    const id = window.setInterval(
      () => setActive((current) => (current + 1) % reelCount),
      PROJECT_DWELL_MS,
    );
    return () => window.clearInterval(id);
  }, [booted, reelHeld, reelOnScreen, reelCount]);

  /* The window's box is the only thing the hit area needs: `laptopScreenBox` runs the very fit the
     scene runs. A ResizeObserver delivers its first observation on `observe`, so nothing is set
     from the effect's own body. */
  useEffect(() => {
    const el = screenRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      const box = laptopScreenBox(rect.width, rect.height);
      setScreenBox(box ? { ...box } : null);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [slug]);

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

        {/* The HUD panels. The three benefits of a direction are a sequence — clarify, build,
            launch — so the row is built to read as one: a pulse enters the first panel's
            circuit, crosses it, and each panel in turn lights, draws its corner brackets and
            fires its node as the pulse reaches it. `--panel-index` is the only thing the
            markup has to say about that; every delay is derived from it in CSS, so the
            stacked layout can flatten the whole sequence with one rule.
            Everything added here is decoration: shapes, light and motion, no numbers about
            the business. Every span below is `aria-hidden` and carries no copy.

            ONE anchor for the whole row, not one per panel: the scene fits thirds of this
            rect (components/scene/choreography.ts), and three equal columns with one gap
            make those thirds predictable. It is only written from 861px up — the same gate
            as the steps corner and as the windows below — because under it the row stacks
            into one column and "thirds of the row" would mean nothing. */}
        <section
          className={styles.highlights}
          ref={highlightsRef}
          data-scene-anchor={desktop ? "panels" : undefined}
        >
          {sol.items.map((it, i) => (
            <article
              key={i}
              className={styles.highlight}
              style={{ "--panel-index": i } as CSSProperties}
              data-tilt={tilt.enabled ? "on" : "off"}
              {...tilt.handlers}
            >
              {/* The painted part of the panel. `--panel`, the padding and the copy all live
                  HERE rather than on the article, so the instrument window below has nothing
                  opaque between it and the scene's canvas — the same move the steps card
                  made for its corner host. The article keeps the border, the radius and the
                  entrance glow, so the panel is still one framed object. */}
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
                <b className="mono">{l(solUI.benefit)}</b>
                <h2>{l(it.title)}</h2>
                <p>{l(it.desc)}</p>
              </div>
              {/* The instrument window: the panel's bottom bay, see-through down to the
                  canvas, with its own chrome (a rule across its head, two guide rails and two
                  corner brackets, all in the panel's accent). Its own box, so on `fallback` /
                  `off` — and below 861px — it is simply not laid out and the panel closes up
                  into the plain card it has always been. */}
              <div aria-hidden="true" className={styles.hlWindow} />
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

            {/* ---- the shape this section takes where the 3D laptop is live ----
                The section IS the machine. The projects run on its display on their own, and
                pressing the display opens the project that is on it. There is no side column and
                no control row: everything a visitor reads is drawn INTO the screen's texture
                (components/scene/three/hologram.ts `composeLaptopScreen`), which is the one way to
                make it legible that does not raise the 384 x 240 cap — the cap being the only
                reason a real e-mail address inside a screenshot stays unreadable.

                Both shapes are always in the DOM and CSS chooses, exactly as the panels' bay and
                the steps corner do: from 861px up, on a renderer that really draws, this stage is
                laid out and the grid below is not; everywhere else — a phone, `fallback`, `off`,
                reduced motion — the stage is `display: none` and the grid is the one we shipped,
                untouched.

                `.projScreen` is the window the machine stands in: see-through, painting no fill,
                nothing at all between it and the canvas behind the page, and no transform,
                perspective, filter, `contain` or clipping overflow here or above it. The scene
                MEASURES this box (components/scene/scrollProbe.ts) rather than assuming it.

                The reel pauses under the pointer and while the focus is inside the stage. */}
            <div
              className={styles.projStage}
              ref={stageRef}
              onPointerEnter={() => setReelHeld(true)}
              onPointerLeave={() => setReelHeld(false)}
              onFocus={() => setReelHeld(true)}
              onBlur={() => setReelHeld(false)}
            >
              <div
                className={styles.projScreen}
                ref={screenRef}
                data-scene-anchor={desktop ? "projects" : undefined}
              >
                {/* The display's own hit area. It is a real element over the part of the window the
                    screen is drawn in — never the whole window — sized from the same fit the scene
                    uses, so it follows the machine at every width. Transparent: it paints nothing
                    between the window and the canvas, and it carries the project's name, so a
                    screen reader hears what pressing it opens.

                    A project with a public page gets a link. One without gets a labelled, focusable
                    image rather than a link that goes nowhere — and it still stops the reel, which
                    is what makes the pause reachable from the keyboard on every project. */}
                {screenBox ? (
                  onScreenProject.url ? (
                    <a
                      className={styles.projHit}
                      href={onScreenProject.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        left: `${Math.round(screenBox.x)}px`,
                        top: `${Math.round(screenBox.y)}px`,
                        width: `${Math.round(screenBox.w)}px`,
                        height: `${Math.round(screenBox.h)}px`,
                      }}
                    >
                      <span className={styles.srOnly}>
                        {`${l(solUI.actionProject)} — ${onScreenProject.name}`}
                      </span>
                    </a>
                  ) : (
                    <span
                      className={styles.projHit}
                      role="img"
                      tabIndex={0}
                      aria-label={`${onScreenProject.name} — ${l(solUI.actionProjectPrivate)}`}
                      style={{
                        left: `${Math.round(screenBox.x)}px`,
                        top: `${Math.round(screenBox.y)}px`,
                        width: `${Math.round(screenBox.w)}px`,
                        height: `${Math.round(screenBox.h)}px`,
                      }}
                    />
                  )
                ) : null}
              </div>

              {/* The same projects, in reading order, for everyone the picture cannot reach: a
                  screen reader, a search engine, a text browser. This is the machine's alt text,
                  and it is why nothing was deleted from the page when the cards stopped being
                  laid out.

                  Visually hidden the standard way — a 1px box with `clip-path: inset(50%)`, NEVER
                  `display: none`, which would take it out of the accessibility tree as well — and
                  it un-hides itself on `:focus-within`, so a sighted visitor who tabs into it sees
                  where they are instead of chasing an invisible focus ring. */}
              <div className={styles.projList}>
                <h3>{l(pageUI.reelListTitle)}</h3>
                <ul>
                  {related.map((p) => (
                    <li key={p.id}>
                      <b>{p.name}</b> <span className="mono">{l(p.tag)}</span>
                      <span> — {l(p.desc)}</span>
                      {p.url ? (
                        <>
                          {" "}
                          <a href={p.url} target="_blank" rel="noopener noreferrer">
                            {l(solUI.actionProject)}
                          </a>
                        </>
                      ) : (
                        <span className="mono"> ({l(solUI.actionProjectPrivate)})</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div
              className={styles.projectGrid}
              ref={projectsRef}
              data-projects-track=""
              data-project-index={reelIndex}
              data-cta-link={l(solUI.actionProject)}
              data-cta-private={l(solUI.actionProjectPrivate)}
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
