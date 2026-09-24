"use client";

import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { CONSENT_EVENT, getConsent } from "@/lib/consent";
import { directions } from "@/lib/directions";
import { isHudBusy } from "@/lib/hud/busy";
import {
  canPrompt,
  createGuideMemoryStore,
  GUIDE_LIMITS,
  isFinal,
  isTypingTarget,
  optOut,
  pickTopic,
  recordPrompt,
  type GuideBlockers,
} from "@/lib/hud/linger";
import { overlaps } from "@/lib/hud/obscure";
import { isGuideTopic, type GuideTopic } from "@/lib/hud/topics";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import { INTRO_GONE_EVENT, isIntroOnScreen } from "@/lib/intro";
import { useRequestFlow, type RequestOptions } from "@/lib/request/RequestFlowProvider";
import { isPageCovered, subscribePageCover } from "@/lib/scrollLock";
import { useSiteContent, type ProjectItem } from "@/lib/siteContent";
import { visibleTimeout } from "@/lib/visibleTimeout";
import { GUIDE_COPY, GUIDE_FAQ } from "./copy";
import styles from "./GuideAssistant.module.css";

/**
 * Ghid TBS — the holographic cube droid in the bottom-right corner. A real
 * `<button aria-haspopup="dialog">` that opens the request flow straight on the guided chat,
 * and, when a visitor lingers on a topic, a short tip next to it.
 *
 * Mounted by `components/hud/HudChrome.tsx` (a lazy part, after consent, the first
 * interaction, the intro and an idle slot), but correct on its own: nothing renders while the
 * cookie question is unanswered or the intro overlay is on screen.
 *
 * WHEN a tip may show is `lib/hud/linger.ts`; this file owns the DOM side of it:
 *   - one IntersectionObserver whose root is the viewport's centre line
 *     (`rootMargin: -50% 0px -50% 0px`, so a tall section counts while it crosses the middle,
 *     whatever its ratio), over `#servicii`, `#lucrari` and every `[data-guide-topic]`;
 *   - a visible-time timer (`visibleTimeout`) re-armed whenever the centre topic changes. When
 *     it fires and `canPrompt` says no for now (typing, cooldown, the page covered…), it waits
 *     again, until the topic can never prompt (`isFinal`);
 *   - ONE module-level memory: the limits hold across client navigations, reset on reload,
 *     and nothing is stored.
 *
 * Visibility (docs/04, "When the chrome shows"):
 *   - away: while the home page's own request form is in view, the avatar and tip fade to
 *     opacity 0 with `pointer-events: none` and their buttons leave the tab order. Never
 *     `display: none`, `visibility: hidden` or `inert`, so the dialog can still hand focus back;
 *   - yield: when focus lands on something the avatar or tip overlaps (WCAG 2.4.11), they fade
 *     the same way until focus moves somewhere clear, or into the guide;
 *   - covered (the dialog, the burger menu): nothing is hidden — the z-order covers the guide —
 *     but a shown tip is cleared and no new one starts.
 *
 * No role, no heading, no live region: an unrequested tip must not interrupt a screen reader.
 * It is linked to the avatar with `aria-describedby`, so it is heard on the button.
 */

/** The page lifetime's one memory (`lib/hud/linger.ts`: "per session" = until reload). */
const memory = createGuideMemoryStore();

/** Unit tests only: forget every tip shown and any opt-out. */
export function resetGuideMemoryForTests(): void {
  memory.reset();
}

/** The viewport's centre line as the observer's root: an element crosses it or it doesn't. */
const CENTRE_LINE = "-50% 0px -50% 0px";

/** The home page's section-layout request form; while it is in view the guide steps away. */
const SECTION_FLOW = '[data-testid="request-flow"][data-layout="section"]';

/**
 * Entrance (`data-state="enter"`), matching the CSS. It used to be the 0.7s a small droid needs
 * to rise into its corner; it is now the length of the GREETING — the projection that builds
 * itself once, at a size where a face can actually be read, before settling into the launcher.
 * 3.4s is derived, not chosen: the projector fires and the cone opens in 0.42s, the sixteen
 * bands need 0.98s to fly in and land (0.675s of stagger over a 0.3s flight), the lock-on and
 * the shockwave run to 1.9s, the hold has to carry the rising half of a breath (the cycle is
 * 4.6s, so 0.85s shows it) and at least one blink, and the settle is 0.65s.
 */
const ENTER_MS = 3400;

/** How long the greeting may wait for the intro to clear before it plays regardless. The shell's
    own watchdog takes the overlay down at 10s, so this only ever fires if that failed too. */
const GREET_WAIT_MS = 11000;

/** How long a line she says stays up before it goes away on its own. */
const SAY_MS = 7000;

/**
 * Nothing is covering her. The page-loading cover's own rule is
 * `html:has([data-scene-stage][data-renderer="pending"])`, so the same selector answers it here
 * — one condition, written once, in the file that owns it.
 */
function isClear(): boolean {
  return (
    !isIntroOnScreen() &&
    document.querySelector('[data-scene-stage][data-renderer="pending"]') === null
  );
}

/**
 * The assistant herself: a cutout portrait, her eyelids, and the wash that makes it a hologram.
 *
 * ONE element carries the breathing (`.figure`) and the treatment sits on the leaves below it.
 * That is not tidiness — this widget sits over the live WebGL canvas and the file's own rule is
 * that no ANCESTOR may take a filter, because it would flatten the `preserve-3d` the orbit rings
 * are drawn in. A filter on `.portrait`, which nothing is drawn inside, groups only itself.
 *
 * The eyelids are the portrait again, sampled from the strip of skin just above each eye and
 * scaled down to nothing at rest. A blink is that strip growing over the eye for a sixth of a
 * second: the colour matches because it IS her skin, out of the same file, and the spectacle
 * frames never move because the lid is drawn inside the lens.
 */
/**
 * THE PROJECTOR — everything the greeting has that the launcher does not.
 *
 * It is a separate component on purpose. `<Figure/>` is rendered by BOTH the launcher button and
 * the greeting, and the launcher must stay cheap; all of this is greeting-only, lives inside a
 * layer that is gated behind [data-live], and is removed from the DOM the moment the entrance
 * ends. Nothing here is paid for at first paint and nothing here is paid for after 2.9s.
 *
 * The SLICES are the whole reason the build can exist at all. This file's keyframes may declare
 * only `transform` and `opacity` — a test walks every block — so a reveal cannot be a moving
 * mask or a growing clip. Sixteen copies of the same bitmap, each with its own STATIC clip-path
 * band and its own delay, give the same picture out of transforms alone: each band flies in from
 * alternating sides, sheared, and lands in register, bottom first, as if she were being drawn up
 * the beam. The scanner bar rides with them.
 *
 * SIXTEEN, and not a round dozen: it is a power of two, so every boundary falls on an exact
 * 6.25% and adjacent clips close with no rounding gap between them. At 12 or 7 the boundaries are
 * repeating decimals and a sub-pixel seam can open along a band edge.
 *
 * They are `background-image` and not <img> so the band is a clip on a full-bleed paint: with
 * `background-size: 100% 100%` every slice carries the WHOLE portrait and the clip decides which
 * strip of it is seen, so all seven are identical but for one number.
 */
const SLICES = 16;

function Projector() {
  return (
    <span className={styles.projector}>
      <span className={styles.emitter} />
      <span className={styles.cone} />
      {/* The slices get a wrapper of their own, and it is not tidiness: they all have to stop
          being drawn on ONE frame, and each of them already carries a per-slice delay on its own
          flight. Two animations on one element that both touch `opacity` do not compose — the
          last in the list simply wins — so the hand-off has to happen one level up. Measured:
          without this the slices were fully opaque from the first frame of the entrance. */}
      <span className={styles.slices}>
        {Array.from({ length: SLICES }, (_, i) => (
          <span
            key={i}
            className={styles.slice}
            style={{ "--i": i, "--n": SLICES } as CSSProperties}
          />
        ))}
      </span>
      <span className={styles.scanner} />
      <span className={styles.shock} />
    </span>
  );
}

function Figure() {
  return (
    <span className={styles.figure}>
      {/* THREE NESTED BOXES, THREE CLOCKS. A person is never still, and never periodic either:
          one sine on one element reads as a mechanism however slow it is. `.figure` sways from
          the chest, `.live` breathes, and the eyelids blink — 11.9s, 4.6s and 9s, which share no
          short common multiple, so the combination does not visibly repeat. They have to be
          separate elements because they all drive `transform`, and two animations on one
          property do not compose: the last one simply wins. */}
      <span className={styles.live}>
      <span className={styles.rim} />
      {/*
        ONE ENCODING, DELIBERATELY. There used to be an AVIF <source> ahead of the WebP, and it
        saved about 10 KB. It cannot stay: every CSS window onto this portrait — the two eyelids,
        the jaw, the rim's mask, the scanline mask — loads the WebP by URL, while the <img> would
        be handed the AVIF. Two lossy encodings of the same bitmap disagree by a value or two on
        smooth skin, and a patch that must colour-match the pixels underneath it draws a hard edge
        wherever they differ. The eyelids get away with it because each is a small opaque scrap
        over an eye; the jaw does not, and neither would anything larger. 31 KB, one file.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element -- see the note above: every CSS
          window onto this portrait loads it by URL, so it has to be one fixed file and not an
          optimiser's hashed output. It is 31 KB in a lazy chunk and never an LCP candidate. */}
      <img
        className={styles.portrait}
        src={PORTRAIT_WEBP}
        srcSet={`${PORTRAIT_WEBP} 384w`}
        sizes={PORTRAIT_SIZES}
        alt=""
        width={554}
        height={628}
        decoding="async"
        draggable={false}
      />
      {/* BEFORE the wash, not after. The scanlines multiply into whatever is under them, so a
          patch painted on top of them arrives as a smooth blotch on a rastered face — the one
          thing that would give the whole trick away. The eyelids have the same ordering
          requirement and survive being wrong for 144ms; the jaw is on screen for seconds. */}
      <span className={styles.jaw} />
      <span className={styles.wash} />
      <span className={styles.lid} data-eye="left" />
      <span className={styles.lid} data-eye="right" />
      </span>
    </span>
  );
}

/* The portrait, from `public/guide`. A plain <img> and not next/image: the file is a fixed
   two-size cutout in a lazy chunk, and every window onto her below — the eyelids, the jaw, the
   rim's mask, the scanline mask — needs the SAME bitmap as a CSS background, which an optimiser's
   hashed URL could not be pointed at. 384w covers a 2x screen at the widest she is ever drawn. */
const PORTRAIT_WEBP = "/guide/asistent-384.webp";
const PORTRAIT_SIZES = "184px";

/** A service page, with or without the /ru or /en prefix (the proxy rewrites onto one tree). */
const SERVICE_PATH = /(?:^|\/)servicii\/([^/?#]+)/;

/* ---- readiness: consent answered, intro gone ------------------------------------------- */

function subscribeReady(onChange: () => void): () => void {
  window.addEventListener(CONSENT_EVENT, onChange);
  window.addEventListener(INTRO_GONE_EVENT, onChange);
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener(INTRO_GONE_EVENT, onChange);
  };
}

const readReady = () => getConsent() !== null && !isIntroOnScreen();

/* ---- page reads ------------------------------------------------------------------------- */

type Target = { topic: GuideTopic; el: HTMLElement };

/** The topics on this page: `#servicii`, `#lucrari`, and each valid `[data-guide-topic]`. */
function collectTargets(): Target[] {
  const targets: Target[] = [];
  for (const topic of ["servicii", "lucrari"] as const) {
    const el = document.getElementById(topic);
    if (el) targets.push({ topic, el });
  }
  for (const el of document.querySelectorAll<HTMLElement>("[data-guide-topic]")) {
    const topic = el.dataset.guideTopic;
    if (isGuideTopic(topic)) targets.push({ topic, el });
  }
  return targets;
}

/** The direction slug of a service page, only when `lib/directions.ts` knows it. */
function serviceSlugOf(pathname: string | null): string | undefined {
  const raw = pathname?.match(SERVICE_PATH)?.[1];
  if (!raw) return undefined;
  let slug: string;
  try {
    slug = decodeURIComponent(raw);
  } catch {
    return undefined;
  }
  return directions.some((d) => d.slug === slug) ? slug : undefined;
}

/**
 * The project at the front of the Work spiral, when there is one: the `[data-helix-front]`
 * card's position among the cards (`#lucrari a, #lucrari article`, the order Work renders
 * `projects` in) names the project. No front card, or a position the content does not have,
 * sends no project. (`data-helix-front` is `HELIX_FRONT_ATTR` in components/scene/helix.ts,
 * written out so this chunk does not import the scene's maths.)
 */
function frontProject(projects: readonly ProjectItem[]): Pick<RequestOptions, "projectId" | "projectName"> {
  const card = document
    .querySelector("#lucrari [data-helix-front]")
    ?.closest("#lucrari a, #lucrari article");
  if (!card) return {};
  const index = Array.from(document.querySelectorAll("#lucrari a, #lucrari article")).indexOf(card);
  const project = index >= 0 ? projects[index] : undefined;
  return project ? { projectId: project.id, projectName: project.name } : {};
}

/* ---- the component ---------------------------------------------------------------------- */

/** The Ghid TBS, or nothing while the cookie question is open or the intro is on screen. */
export function GuideAssistant() {
  const ready = useSyncExternalStore(subscribeReady, readReady, () => false);
  return ready ? <Guide /> : null;
}

function Guide() {
  const l = useLoc();
  const pathname = usePathname();
  const path = pathname ?? "";
  const { isOpen, openRequest } = useRequestFlow();
  const { projects } = useSiteContent();
  const tipId = useId();

  /* The tip is tied to the page it showed on: a client navigation clears it without an effect
     having to (the new page may have no topic to re-run the observer for). Same for away. */
  const [tip, setTip] = useState<{ topic: GuideTopic; path: string } | null>(null);
  const prompt = tip !== null && tip.path === path ? tip.topic : null;
  const [awayOn, setAwayOn] = useState<string | null>(null);
  const away = awayOn !== null && awayOn === path;
  const [entering, setEntering] = useState(true);
  const [greeting, setGreeting] = useState(false);
  /*
   * WHAT SHE IS SAYING, if anything, and WHICH ANSWER is open.
   *
   * `said` counts up so a new line remounts the bubble: `guide-tip-in` is identified by its NAME,
   * and a rule that re-applies the same name to the same node updates its timing instead of
   * restarting it — the trap this file already has fourteen lines about. A changing key makes
   * React give the bubble a new node, so the rise fires every time she speaks.
   */
  const [say, setSay] = useState<{ said: number; text: LocalizedText } | null>(null);
  const [asked, setAsked] = useState<string | null>(null);
  const [faq, setFaq] = useState(false);
  const saidRef = useRef(0);
  const speak = (text: LocalizedText) => {
    saidRef.current += 1;
    setSay({ said: saidRef.current, text });
  };
  const [yielded, setYielded] = useState(false);

  /* The request dialog opening clears the tip (adjusted during render, not in an effect). */
  const [openSeen, setOpenSeen] = useState(isOpen);
  if (openSeen !== isOpen) {
    setOpenSeen(isOpen);
    if (isOpen) setTip(null);
  }

  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  /* Read by timers and handlers, written by effects and observers only. */
  const centreRef = useRef<GuideTopic | null>(null);
  const awayRef = useRef(false);
  const requestOpenRef = useRef(isOpen);

  useEffect(() => {
    requestOpenRef.current = isOpen;
  }, [isOpen]);

  /*
   * THE GREETING WAITS UNTIL SHE CAN BE SEEN, and that is not the same moment as this component
   * mounting. TWO things cover the HUD by contract, and both had to be found the hard way:
   *
   *   - the INTRO overlay, which sits above --z-guide with no hide logic (docs/04);
   *   - the PAGE-LOADING cover (`components/ui/PageLoading.tsx`), which is opaque and up for as
   *     long as the 3D stage has not answered.
   *
   * Photographed at 1400 x 900 while the greeting reported opacity 1 and the root sat at
   * (1292, 792, 88, 88): the frame showed BootCore turning on the loading cover and nothing of
   * her at all. `document.elementsFromPoint` inside the root came back
   * `DIV.grid > DIV.cover > SPAN.signal` — the cover, over the guide, exactly as designed. A
   * greeting started on mount is therefore spent behind a screen nobody is looking past.
   *
   * The cover's own condition is a document-level one, so it can be asked directly rather than
   * guessed at. The clock starts on the first frame both are clear, and a cap keeps the promise
   * anyway if one never lifts — the cover's own failsafe is 6s and the shell's watchdog 10s.
   */
  useEffect(() => {
    let frame = 0;
    let timer = 0;
    const from = performance.now();
    const start = () => {
      setGreeting(true);
      timer = window.setTimeout(() => {
        setGreeting(false);
        setEntering(false);
        /* The first thing she does once she is standing in the corner. */
        speak(GUIDE_COPY.hello);
      }, ENTER_MS);
    };
    const tick = () => {
      if (isClear() || performance.now() - from > GREET_WAIT_MS) start();
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, []);

  /* The linger engine: the centre-line observer and the visible-time timer. */
  useEffect(() => {
    const targets = collectTargets();
    if (targets.length === 0 || typeof IntersectionObserver === "undefined") return;

    const readBlockers = (): GuideBlockers => ({
      covered: isPageCovered(),
      intro: isIntroOnScreen(),
      banner: getConsent() === null,
      typing: isTypingTarget(document.activeElement),
      requestOpen: requestOpenRef.current,
      away: awayRef.current,
      busy: isHudBusy(),
    });

    const live = new Set<Target>();
    let timed: GuideTopic | null = null;
    let cancel = () => {};

    const wait = (topic: GuideTopic) => {
      cancel = visibleTimeout(GUIDE_LIMITS.lingerMs, () => {
        const now = performance.now();
        const current = memory.get();
        if (canPrompt(current, topic, now, readBlockers())) {
          memory.set(recordPrompt(current, topic, now));
          setTip({ topic, path });
        } else if (!isFinal(current, topic)) {
          wait(topic);
        }
      });
    };

    const rearm = () => {
      // In `collectTargets` order, not the order the observer reported in: a tie goes to the first.
      const topic = pickTopic(targets.filter((target) => live.has(target))) as GuideTopic | null;
      centreRef.current = topic;
      if (topic === timed) return;
      cancel();
      cancel = () => {};
      timed = topic;
      // A tip about a section that left the centre line goes with it.
      setTip((shown) => (shown !== null && shown.topic !== topic ? null : shown));
      if (topic !== null && !isFinal(memory.get(), topic)) wait(topic);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          for (const target of targets) {
            if (target.el !== entry.target) continue;
            if (entry.isIntersecting) live.add(target);
            else live.delete(target);
          }
        }
        rearm();
      },
      { rootMargin: CENTRE_LINE },
    );
    for (const target of targets) observer.observe(target.el);

    return () => {
      observer.disconnect();
      cancel();
      centreRef.current = null;
    };
  }, [path]);

  /* Away: the section-layout request form intersects the viewport. */
  useEffect(() => {
    const flows = document.querySelectorAll(SECTION_FLOW);
    if (flows.length === 0 || typeof IntersectionObserver === "undefined") return;

    const inView = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inView.add(entry.target);
          else inView.delete(entry.target);
        }
        awayRef.current = inView.size > 0;
        setAwayOn(awayRef.current ? path : null);
      },
      { threshold: 0 },
    );
    for (const flow of flows) observer.observe(flow);

    return () => {
      observer.disconnect();
      awayRef.current = false;
    };
  }, [path]);

  /* Covered (the dialog, the burger menu): clear the tip. Nothing is hidden. */
  useEffect(
    () =>
      subscribePageCover(() => {
        if (isPageCovered()) setTip(null);
      }),
    [],
  );

  /* Focus Not Obscured: yield while the focused element sits under the avatar or the tip. */
  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      const root = rootRef.current;
      if (!root || !(target instanceof Element)) return;
      if (root.contains(target)) {
        setYielded(false);
        return;
      }
      const focused = target.getBoundingClientRect();
      const avatar = buttonRef.current?.getBoundingClientRect();
      const bubbleRect = tipRef.current?.getBoundingClientRect();
      const underTip = bubbleRect !== undefined && overlaps(bubbleRect, focused);
      setYielded(underTip || (avatar !== undefined && overlaps(avatar, focused)));
      if (underTip) setTip(null);
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);

  /** Take the tip down; focus that was inside it goes to the avatar, not to <body>. */
  const closeTip = () => {
    const hadFocus = tipRef.current?.contains(document.activeElement) ?? false;
    setTip(null);
    if (hadFocus) buttonRef.current?.focus();
  };

  const never = () => {
    memory.set(optOut(memory.get()));
    closeTip();
  };

  const open = (source: "guide" | "guide-prompt") => {
    const topic = prompt ?? centreRef.current;
    setTip(null);
    const serviceSlug = serviceSlugOf(pathname);
    openRequest({
      source,
      openAssistant: true,
      ...(topic !== null ? { guideTopic: topic } : {}),
      ...(serviceSlug !== undefined ? { serviceSlug } : {}),
      // A project only when the visitor is on the projects: elsewhere a front card is stale.
      ...(topic === "lucrari" ? frontProject(projects) : {}),
      returnFocusTo: buttonRef.current,
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || event.repeat || prompt === null) return;
    closeTip();
  };

  /**
   * WHICH MODE THE ONE BUBBLE IS IN, in order of who asked for it.
   *
   * The questions come first: the visitor pressed her for them. A topic tip comes next, because
   * it is about the section they are actually reading. A line she says is last — it is ambient,
   * it was nobody's request, and it goes away on its own after SAY_MS. Put the ambient line above
   * the contextual tip and a visitor who lingers on a section gets a greeting instead of the
   * thing the section is for.
   */
  const bubble: "faq" | "tip" | "say" | null =
    faq ? "faq" : prompt !== null ? "tip" : say !== null ? "say" : null;

  const answer = (id: string) => GUIDE_FAQ.find((entry) => entry.id === id)?.a ?? GUIDE_COPY.faqIntro;

  /*
   * The ✕ closes WHAT IS ON SCREEN, which is not the same as what is set.
   *
   * She can be mid-sentence while a topic tip is showing over the top of it — the tip outranks
   * her — and a ✕ that closed the higher-priority state would dismiss the line nobody could see
   * and leave the tip sitting there. Caught by the two tests that dismiss a tip and expect it
   * gone. So this switches on the SAME value the bubble renders from.
   */
  const closeBubble = () => {
    if (bubble === "faq") {
      setFaq(false);
      setAsked(null);
      setSay(null);
      buttonRef.current?.focus();
      return;
    }
    if (bubble === "tip") {
      closeTip();
      return;
    }
    setSay(null);
  };

  /*
   * A LINE SHE SAYS IS NOT A PANEL: it goes away on its own, and so does her mouth.
   *
   * Seven seconds is long enough to read one sentence twice and short enough that it is not still
   * sitting there when a visitor comes back to the tab. It runs even while the questions are
   * open, and that is the point: the ANSWER stays on screen (it renders from `asked`), but she
   * stops talking. A mouth that keeps moving under a paragraph nobody is reading aloud any more
   * is the thing that would make her look like a puppet.
   */
  useEffect(() => {
    if (say === null) return;
    const id = window.setTimeout(() => setSay(null), SAY_MS);
    return () => window.clearTimeout(id);
  }, [say]);

  const state = prompt !== null ? "prompt" : entering ? "enter" : "idle";
  const tabIndex = away ? -1 : 0;

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-hud=""
      data-guide=""
      data-state={state}
      data-greet={greeting ? "" : undefined}
      data-say={say !== null ? "" : undefined}
      data-away={away ? "" : undefined}
      data-yield={yielded ? "" : undefined}
      onKeyDown={onKeyDown}
    >
      {/* THE GREETING. The launcher is 52 to 88px because docs/04 fixes that box, and a face
          read at 88px is a thumbnail — a blink there is two pixels. So she introduces herself
          ONCE, as a projection roughly three times that size, anchored to the same corner and
          overflowing it upward and to the left, and then settles into the launcher.
          It takes no pointer events and is out of the accessibility tree: the button underneath
          is the control, is already in the tab order, and is never covered by anything that can
          be clicked. It is in the DOM only while `data-state="enter"`. */}
      {greeting && (
        <span className={styles.greeting} aria-hidden="true" data-testid="guide-greeting">
          <Projector />
          {/* And the figure gets one too, for the same reason in reverse: it must not be drawn
              until the slices have finished drawing her, and `.figure`, `.live` and `.lid` are
              all carrying animations of their own already. */}
          <span className={styles.reveal}>
            <Figure />
          </span>
        </span>
      )}
      <button
        ref={buttonRef}
        type="button"
        className={styles.avatar}
        data-testid="guide-avatar"
        aria-expanded={faq}
        aria-label={l(GUIDE_COPY.aria)}
        aria-describedby={bubble !== null ? tipId : undefined}
        tabIndex={tabIndex}
        onClick={() => {
          setFaq((on) => !on);
          setAsked(null);
          setSay(null);
        }}
      >
        <span className={styles.scene} aria-hidden="true">
          <span className={styles.beam} />
          <Figure />
          <span className={styles.orbit} data-orbit="a">
            <span className={styles.packet} />
          </span>
          <span className={styles.orbit} data-orbit="b">
            <span className={styles.packet} />
          </span>
          <span className={styles.signal} />
        </span>
        <span className={styles.caption} aria-hidden="true">
          {l(GUIDE_COPY.label)}
        </span>
      </button>

      {/*
        ONE BUBBLE, THREE MODES, and that is the whole design decision.
        The guide already had a bubble above her for topic tips. A second bubble system for
        speech and a third for questions would be three things to keep out of each other's way in
        one corner; instead the one bubble gains a mode. `key` remounts it on every change, so the
        rise animation fires each time — the keyframe-name trap this file documents at length.
      */}
      {bubble !== null && (
        <div
          key={bubble}
          ref={tipRef}
          className={styles.tip}
          data-mode={bubble}
          data-testid={bubble === "tip" ? "guide-tip" : bubble === "faq" ? "guide-faq" : "guide-say"}
        >
          <p className={styles.tipKicker} aria-hidden="true">
            {bubble === "faq" ? l(GUIDE_COPY.faqHead) : l(GUIDE_COPY.label)}
          </p>

          {bubble === "tip" && prompt !== null && (
            <>
              {/* The description is the tip's sentence only, not its buttons' names. */}
              <p id={tipId} className={styles.tipText}>
                {l(GUIDE_COPY.prompts[prompt])}
              </p>
              <div className={styles.tipActions}>
                <button
                  type="button"
                  className={styles.tipOpen}
                  tabIndex={tabIndex}
                  onClick={() => open("guide-prompt")}
                >
                  {l(GUIDE_COPY.open)}
                </button>
                <button type="button" className={styles.tipNever} tabIndex={tabIndex} onClick={never}>
                  {l(GUIDE_COPY.never)}
                </button>
              </div>
            </>
          )}

          {bubble === "say" && say !== null && (
            <p id={tipId} className={styles.tipText}>
              {l(say.text)}
            </p>
          )}

          {bubble === "faq" && (
            <>
              <p id={tipId} className={styles.tipText}>
                {asked === null ? l(GUIDE_COPY.faqIntro) : l(answer(asked))}
              </p>
              {/* A LIST AND NOT A CHIP ROW. The estimator's options are two-word pills; these are
                  whole questions, and six of them wrapped across a 340px bubble is a ragged stack
                  that leaves the answer nowhere to live. One per line, in the estimator's own
                  raised-chip material. */}
              <ul className={styles.askList}>
                {GUIDE_FAQ.filter((entry) => entry.id !== asked).map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      className={styles.ask}
                      tabIndex={tabIndex}
                      onClick={() => {
                        setAsked(entry.id);
                        speak(entry.a);
                      }}
                    >
                      {l(entry.q)}
                    </button>
                  </li>
                ))}
              </ul>
              <div className={styles.tipActions}>
                <button
                  type="button"
                  className={styles.tipOpen}
                  tabIndex={tabIndex}
                  onClick={() => open("guide")}
                >
                  {l(GUIDE_COPY.open)}
                </button>
              </div>
            </>
          )}

          <button
            type="button"
            className={styles.tipClose}
            aria-label={l(bubble === "faq" ? GUIDE_COPY.faqClose : GUIDE_COPY.dismiss)}
            tabIndex={tabIndex}
            onClick={closeBubble}
          >
            <X aria-hidden="true" strokeWidth={1.75} strokeLinecap="square" strokeLinejoin="miter" />
          </button>
        </div>
      )}
    </div>
  );
}
