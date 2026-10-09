"use client";

import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { CONSENT_EVENT, getConsent } from "@/lib/consent";
import { mediaMatches, PREFERS_REDUCED_MOTION } from "@/lib/device";
import { directions } from "@/lib/directions";
import { overlaps } from "@/lib/hud/obscure";
import { useLoc } from "@/lib/i18n/content";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { INTRO_GONE_EVENT, isIntroOnScreen } from "@/lib/intro";
import { useRequestFlow } from "@/lib/request/RequestFlowProvider";
import { isPageCovered, subscribePageCover } from "@/lib/scrollLock";
import { GUIDE_COPY, GUIDE_FAQ } from "./copy";
import { poseAt, speechTrack, type MouthPose } from "./speech";
import styles from "./GuideAssistant.module.css";

/**
 * The assistant in the bottom-right corner: a holographic projection of a person, the size of
 * her square and no bigger, who answers a short list of written questions when she is pressed
 * and opens the request flow from her bubble.
 *
 * **NOTHING HERE OPENS A PANEL THE VISITOR DID NOT ASK FOR**, and it took two removals to get
 * there. The GUIDE went first (2026-09-26): the tip that appeared by itself after a linger on a
 * section, with "Deschide ghidul" and "Nu mai arata" under it, and with it the linger engine
 * (`lib/hud/linger.ts`), the topic scanning (`[data-guide-topic]`) and its prompts. The spoken
 * GREETING went the same day — one sentence in a bubble, right after the entrance, which is the
 * panel the owner photographed and asked to be rid of.
 *
 * Then the ENTRANCE went too, the same day and for the same reason: she used to build herself
 * out of a projector cone in sixteen flying bands, at 230-320px — three times her launcher —
 * over the corner of the page, before settling into the square. "Fa sa nu apara mare, scoate,
 * lasa doar asistentul cel mic in patrat." She is now only ever the square: she fades in where
 * she stands, and that is the whole of it.
 *
 * So the bubble has ONE mode left, her questions, and it is only ever on screen because someone
 * pressed her for it.
 *
 * Mounted by `components/hud/HudChrome.tsx` (a lazy part, after consent, the first
 * interaction, the intro and an idle slot), but correct on its own: nothing renders while the
 * cookie question is unanswered or the intro overlay is on screen.
 *
 * Visibility (docs/04, "When the chrome shows"):
 *   - away: while the home page's own request form is in view, the avatar and bubble fade to
 *     opacity 0 with `pointer-events: none` and their buttons leave the tab order. Never
 *     `display: none`, `visibility: hidden` or `inert`, so the dialog can still hand focus back;
 *   - yield: when focus lands on something the avatar or her bubble overlaps (WCAG 2.4.11), they
 *     fade the same way until focus moves somewhere clear, or into her;
 *   - covered (the dialog, the burger menu): nothing is hidden — the z-order covers her — but
 *     her mouth stops.
 *
 * No role, no heading, no live region: the answer is linked to the avatar with `aria-describedby`,
 * so a screen reader hears it on the button that opened it.
 */

/** Unit tests only: nothing is remembered any more, and the suite still calls it. */
export function resetGuideMemoryForTests(): void {}

/** The home page's section-layout request form; while it is in view she steps away. */
const SECTION_FLOW = '[data-testid="request-flow"][data-layout="section"]';

/**
 * The longest she speaks: an answer that would take longer to say stops at a comma or full stop in
 * its last stretch before this, or else after its last whole word (speech.ts `trimmed`). A short
 * one stops when its text does.
 */
const SAY_MS = 7000;

/**
 * The frames tools/guide/mouth.mjs drew: OPENINGS (shut .. her widest) by SHAPES (rounded,
 * neutral, spread), one portrait-sized file each, /guide/gura/<opening>-<shape>.webp. Change them
 * together with the script's OPEN_STEPS and SHAPES — which must stay evenly spaced with neutral in
 * the middle, at 1: SHUT_FRAME, paintMouth's rest (FRAME_CSS[1][0]) and the stylesheet's fallback
 * all name 0-1.webp (tools/guide/README.md).
 */
const MOUTH_OPENINGS = 11;
const MOUTH_SHAPES = 3;
const mouthFrameUrl = (opening: number, shape: number) => `/guide/gura/${opening}-${shape}.webp`;
/** The shut, neutral frame: her mouth at rest. */
const SHUT_FRAME = mouthFrameUrl(0, 1);
/** Every frame's file, [shape][opening], and the `--f` a layer draws it with — built once. */
const FRAME_URLS = Array.from({ length: MOUTH_SHAPES }, (_, shape) =>
  Array.from({ length: MOUTH_OPENINGS }, (_, opening) => mouthFrameUrl(opening, shape)),
);
const FRAME_CSS = FRAME_URLS.map((row) => row.map((url) => `url("${url}")`));

/*
 * Her mouth's frames, fetched and decoded once a page. An answer that starts before they all are
 * is said with her mouth at rest — a layer whose file is not in yet would paint nothing, and her
 * mouth would flicker. In practice they are in long before anyone asks her anything. If one fails
 * to load, they are not "ready" at all (her mouth stays at rest) and the next answer asks again.
 */
let framesReady = false;
let framesLoading: Promise<void> | null = null;
/*
 * KEPT, not just decoded. A loaded image nothing references any more is dropped from the memory
 * cache, and the next layer to name its file fetches it again — a round trip in which that layer
 * paints nothing (measured at a 50 ms RTT: on the first answer, 44 display frames with the base
 * layer blank, her portrait's shut lips showing through). The sprite never had this problem: every
 * layer named the one file from the first paint. These 33 objects are what names the frames now.
 */
const keptFrames: HTMLImageElement[] = [];
function loadMouthFrames(): Promise<void> {
  framesLoading ??= Promise.all(
    FRAME_URLS.flat().map((url) => {
      const image = new Image();
      image.setAttribute("fetchpriority", "low");
      image.src = url;
      keptFrames.push(image);
      return typeof image.decode === "function" ? image.decode() : Promise.resolve();
    }),
  ).then(
    () => {
      framesReady = true;
    },
    () => {
      framesLoading = null;
      keptFrames.length = 0;
    },
  );
  return framesLoading;
}

/**
 * How long an interrupted mouth takes to close: a new question, ✕ or Escape mid-word, or a
 * language switch. It closes the way a person stops — over a closing's length, easing in and out
 * — not in one frame, and the next answer starts from where it was.
 */
const RELEASE_S = 0.15;

/** How much of the interrupted pose is left `seconds` after the interruption: 1 down to 0. */
function release(seconds: number): number {
  if (!(seconds > 0)) return 1;
  if (seconds >= RELEASE_S) return 0;
  const x = seconds / RELEASE_S;
  return 1 - x * x * (3 - 2 * x);
}

/**
 * One pose of the mouth, painted on its four layers: the four drawn frames around (open, shape),
 * each at its bilinear weight, composed "over" from the bottom — the bottom layer opaque, each
 * layer above at its weight over the weights at and below it. Shut is the bottom layer on the
 * shut frame, alone: the frames are never switched off (the stylesheet says why).
 */
function paintMouth(layers: readonly HTMLElement[], pose: MouthPose): void {
  /* at rest only: lips pressed shut for an /m/ keep the corners of the shape around it */
  if (pose.open < 0.002 && Math.abs(pose.shape) < 0.002) {
    layers.forEach((layer, i) => {
      layer.style.setProperty("--f", FRAME_CSS[1][0]);
      layer.style.setProperty("--o", i === 0 ? "1" : "0");
    });
    return;
  }
  const c = Math.min(MOUTH_OPENINGS - 1, Math.max(0, pose.open * (MOUTH_OPENINGS - 1)));
  const r = Math.min(MOUTH_SHAPES - 1, Math.max(0, ((pose.shape + 1) * (MOUTH_SHAPES - 1)) / 2));
  const c0 = Math.floor(c);
  const r0 = Math.floor(r);
  const c1 = Math.min(MOUTH_OPENINGS - 1, c0 + 1);
  const r1 = Math.min(MOUTH_SHAPES - 1, r0 + 1);
  const fc = c - c0;
  const fr = r - r0;
  const frames: [number, number, number][] = [
    [c0, r0, (1 - fc) * (1 - fr)],
    [c1, r0, fc * (1 - fr)],
    [c0, r1, (1 - fc) * fr],
    [c1, r1, fc * fr],
  ];
  let below = 0;
  frames.forEach(([col, row, weight], i) => {
    below += weight;
    const layer = layers[i];
    if (!layer) return;
    layer.style.setProperty("--f", FRAME_CSS[row][col]);
    layer.style.setProperty("--o", i === 0 ? "1" : below > 0 ? (weight / below).toFixed(4) : "0");
  });
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
function Figure({ mouthRef, ready }: { mouthRef: RefObject<HTMLSpanElement | null>; ready: boolean }) {
  return (
    <span className={styles.figure}>
      {/* THREE NESTED BOXES, THREE CLOCKS. A person is never still, and never periodic either:
          one sine on one element reads as a mechanism however slow it is. `.figure` sways from
          the chest, `.live` breathes, and the eyelids blink — 11.9s, 4.6s and 9s, which share no
          short common multiple, so the combination does not visibly repeat. They have to be
          separate elements because they all drive `transform`, and two animations on one
          property do not compose: the last one simply wins. `data-face` is her face's two files
          decoded (see `faceReady`). */}
      <span className={styles.live} data-face={ready ? "" : undefined}>
      <span className={styles.rim} />
      {/*
        ONE ENCODING, DELIBERATELY. There used to be an AVIF <source> ahead of the WebP, and it
        saved about 10 KB. It cannot stay: every CSS window onto this portrait — the two eyelids,
        the rim's mask, the scanline mask — loads the WebP by URL, while the <img> would be handed
        the AVIF. Two lossy encodings of the same bitmap disagree by a value or two on smooth
        skin, and a patch that must colour-match the pixels underneath it draws a hard edge
        wherever they differ. 31 KB, one file. (The mouth frames are files of their own, drawn
        from THIS file's decoded pixels; their outermost pixels fade to transparent over ground
        where every frame is the portrait unchanged, which is what soaks up their own encoding.)
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
      {/* BEFORE the wash, not after. The scanlines multiply into whatever is under them, so
          anything painted on top of them arrives as a smooth blotch on a rastered face — the one
          thing that would give the whole trick away. */}
      {/* HER MOUTH: frames of her own face, warped (tools/guide/mouth.mjs), on four layers that
          each cover the portrait's own rectangle, so any pose between two frames is a blend of
          the four around it. The bottom one shows the shut frame even while she is silent, so
          speaking never changes how her mouth is drawn (the stylesheet says why). The guide
          plays them (paintMouth). */}
      <span ref={mouthRef} className={styles.mouth}>
        <span className={styles.mouthFrame} />
        <span className={styles.mouthFrame} />
        <span className={styles.mouthFrame} />
        <span className={styles.mouthFrame} />
      </span>
      <span className={styles.wash} />
      <span className={styles.lid} data-eye="left" />
      <span className={styles.lid} data-eye="right" />
      </span>
    </span>
  );
}

/* The portrait, from `public/guide`. A plain <img> and not next/image: the file is a fixed
   two-size cutout in a lazy chunk, and every window onto her below — the eyelids, the rim's mask,
   the scanline mask — needs the SAME bitmap as a CSS background, which an optimiser's hashed URL
   could not be pointed at. (Her mouth draws from files of its own, /guide/gura/*.webp, the
   frames tools/guide/mouth.mjs makes out of this one.) 384w covers a 2x screen at the widest she
   is ever drawn. */
const PORTRAIT_WEBP = "/guide/asistent-384.webp";
const PORTRAIT_SIZES = "184px";

/**
 * A file fetched and decoded. It settles either way, so a missing file never keeps her face away.
 * (Both files waited for this way stay referenced by the page itself: the <img>, and the bottom
 * mouth layer's default frame.)
 */
function decoded(src: string): Promise<unknown> {
  const image = new Image();
  image.src = src;
  return typeof image.decode === "function" ? image.decode().catch(() => undefined) : Promise.resolve();
}

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

/* ---- the component ---------------------------------------------------------------------- */

/** The assistant, or nothing while the cookie question is open or the intro is on screen. */
export function GuideAssistant() {
  const ready = useSyncExternalStore(subscribeReady, readReady, () => false);
  return ready ? <Guide /> : null;
}

function Guide() {
  const l = useLoc();
  const { locale } = useLanguage();
  const pathname = usePathname();
  const path = pathname ?? "";
  const { isOpen, openRequest } = useRequestFlow();
  const tipId = useId();

  /* Away is tied to the page it was set on: a client navigation clears it without an effect. */
  const [awayOn, setAwayOn] = useState<string | null>(null);
  const away = awayOn !== null && awayOn === path;
  /*
   * IS HER MOUTH MOVING, and WHICH ANSWER is open.
   *
   * `talking` is not WHAT she says — the bubble renders the answer from `asked`, and her mouth
   * says that same text. It is only whether she is speaking it (`data-say`). It counts up
   * rather than toggling so that a second question RESTARTS the track below instead of
   * inheriting what was left of the first one’s.
   */
  const [talking, setTalking] = useState(0);
  const [asked, setAsked] = useState<string | null>(null);
  const [faq, setFaq] = useState(false);
  const speak = () => setTalking((n) => n + 1);
  const hush = () => setTalking(0);
  const [yielded, setYielded] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const mouthRef = useRef<HTMLSpanElement>(null);
  /* The pose her mouth was last painted in: where an interrupted answer closes from. */
  const shownRef = useRef<MouthPose>({ open: 0, shape: 0 });
  /*
   * HER FACE APPEARS WHOLE. It is the portrait and, over it, her shut frame — the frame that stands
   * in for the portrait's own mouth (the stylesheet says why). Shown before that frame arrived, her
   * lips would be redrawn a moment later, standing still, in front of whoever is looking at her —
   * so the face waits for both. On a fast link that is before her 0.4s fade-in ends. The other
   * frames are fetched at the same time, behind them.
   */
  const [faceReady, setFaceReady] = useState(false);
  useEffect(() => {
    let live = true;
    void Promise.all([decoded(PORTRAIT_WEBP), decoded(SHUT_FRAME)]).then(() => {
      if (live) setFaceReady(true);
    });
    /* under reduced motion her mouth never moves, and the shut frame is all it shows */
    if (!mediaMatches(PREFERS_REDUCED_MOTION)) void loadMouthFrames();
    return () => {
      live = false;
    };
  }, []);
  /* Read by timers and handlers, written by effects and observers only. */
  const awayRef = useRef(false);
  const requestOpenRef = useRef(isOpen);

  useEffect(() => {
    requestOpenRef.current = isOpen;
  }, [isOpen]);

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

  /* Covered (the dialog, the burger menu): she stops talking. Nothing is hidden. */
  useEffect(
    () =>
      subscribePageCover(() => {
        if (isPageCovered()) hush();
      }),
    [],
  );

  /* Focus Not Obscured: yield while the focused element sits under the avatar or her bubble. */
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
      /* Her questions are NOT taken down here: the visitor asked for them, and yielding
         already fades her and the bubble out of the focused element's way. */
      const underTip = bubbleRect !== undefined && overlaps(bubbleRect, focused);
      setYielded(underTip || (avatar !== undefined && overlaps(avatar, focused)));
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);

  const open = () => {
    const serviceSlug = serviceSlugOf(pathname);
    openRequest({
      source: "guide",
      openAssistant: true,
      ...(serviceSlug !== undefined ? { serviceSlug } : {}),
      returnFocusTo: buttonRef.current,
    });
  };

  const answer = (id: string) => GUIDE_FAQ.find((entry) => entry.id === id)?.a ?? GUIDE_COPY.faqIntro;

  /* The ✕ puts her questions away. The focus goes back to the avatar rather than to <body>:
     the ✕ lives inside the bubble that is about to stop existing. */
  const closeBubble = () => {
    setFaq(false);
    setAsked(null);
    hush();
    buttonRef.current?.focus();
  };

  /** Escape closes the questions — the one panel this component has. */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || event.repeat || !faq) return;
    closeBubble();
  };

  /*
   * SHE SAYS THE ANSWER, and stops before it goes away (2026-10-08).
   *
   * Her mouth follows the answer's own text (speech.ts): it opens wide on an /a/, rounds on an
   * /o/, shuts for an /m/, rests at a comma — at the rate a person talks, every syllable a little
   * different. It used to be a 4.7s loop of made-up syllables for a fixed seven seconds, so the
   * one-line answer was "said" for five seconds after its last word.
   *
   * The ANSWER stays on screen for as long as the visitor wants it (it renders from `asked`); her
   * mouth stops when the text does, and never later than SAY_MS — a long answer stops at a pause
   * in its last stretch before that, or else after its last whole word (speech.ts `trimmed`). A
   * mouth still moving under a paragraph nobody is reading any more is the thing that would make
   * her look like a puppet.
   *
   * INTERRUPTED — another question, ✕, Escape, the language — the mouth closes from wherever it
   * is over RELEASE_S, and a new answer starts from there: nothing snaps shut between two frames.
   *
   * Under reduced motion the mouth does not move at all; `data-say` still follows the text's
   * length. The frames are painted straight onto the four layers, one rAF a frame and only while
   * she speaks or closes — nothing re-renders.
   */
  const line = talking > 0 && asked !== null ? l(answer(asked)) : null;
  useEffect(() => {
    const layers = Array.from(mouthRef.current?.children ?? []).filter(
      (el): el is HTMLElement => el instanceof HTMLElement,
    );
    const shown = shownRef.current;
    const from: MouthPose = { open: shown.open, shape: shown.shape };
    const paint = (p: MouthPose) => {
      paintMouth(layers, p);
      shown.open = p.open;
      shown.shape = p.shape;
    };
    const pose: MouthPose = { open: 0, shape: 0 };
    const start = performance.now();
    let frame = 0;
    if (line === null) {
      /* silent: close whatever an interruption left open, then stop */
      if (layers.length === 0 || (from.open < 0.002 && Math.abs(from.shape) < 0.002)) return;
      frame = requestAnimationFrame(function tick(now) {
        const left = release((now - start) / 1000);
        pose.open = from.open * left;
        pose.shape = from.shape * left;
        paint(pose);
        if (left > 0) frame = requestAnimationFrame(tick);
      });
      return () => cancelAnimationFrame(frame);
    }
    const track = speechTrack(line, locale, SAY_MS / 1000);
    const done = window.setTimeout(() => setTalking(0), Math.ceil(track.duration * 1000));
    if (layers.length === 0 || mediaMatches(PREFERS_REDUCED_MOTION)) {
      return () => window.clearTimeout(done);
    }
    /* decided once per answer: frames that arrive halfway through must not make her mouth jump.
       Not in yet (or failed): this answer is said at rest, and they are asked for again. */
    const moving = framesReady;
    if (!moving) void loadMouthFrames();
    frame = requestAnimationFrame(function tick(now) {
      const seconds = (now - start) / 1000;
      poseAt(track, seconds, pose);
      if (!moving) {
        pose.open = 0;
        pose.shape = 0;
      }
      /* the new track starts shut; what an interruption left open closes over it */
      const left = release(seconds);
      pose.open = Math.min(1, pose.open + from.open * left);
      pose.shape = Math.max(-1, Math.min(1, pose.shape + from.shape * left));
      paint(pose);
      frame = requestAnimationFrame(tick);
    });
    return () => {
      window.clearTimeout(done);
      cancelAnimationFrame(frame);
    };
    // `talking` restarts the track when the same question is asked again
  }, [line, locale, talking]);

  const tabIndex = away ? -1 : 0;

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-hud=""
      data-guide=""
      data-say={talking > 0 ? "" : undefined}
      data-away={away ? "" : undefined}
      data-yield={yielded ? "" : undefined}
      onKeyDown={onKeyDown}
    >
      <button
        ref={buttonRef}
        type="button"
        className={styles.avatar}
        data-testid="guide-avatar"
        aria-expanded={faq}
        aria-label={l(GUIDE_COPY.aria)}
        aria-describedby={faq ? tipId : undefined}
        tabIndex={tabIndex}
        onClick={() => {
          setFaq((on) => !on);
          setAsked(null);
          hush();
        }}
      >
        <span className={styles.scene} aria-hidden="true">
          <span className={styles.beam} />
          <Figure mouthRef={mouthRef} ready={faceReady} />
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
        HER QUESTIONS, and nothing else lives in this bubble any more.
        It used to have three modes — a topic tip, a line she said, and these — and both of the
        others were things she started on her own, so both are gone. The node is created when
        `faq` turns on, which is what makes the rise animation fire: `guide-tip-in` is identified
        by its NAME, and re-applying the same name to a node that already has it updates its
        timing instead of restarting it (the trap this file documents at length).
      */}
      {faq && (
        <div ref={tipRef} className={styles.tip} data-testid="guide-faq">
          <p className={styles.tipKicker} aria-hidden="true">
            {l(GUIDE_COPY.faqHead)}
          </p>

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
                    speak();
                  }}
                >
                  {l(entry.q)}
                </button>
              </li>
            ))}
          </ul>
          <div className={styles.tipActions}>
            <button type="button" className={styles.tipOpen} tabIndex={tabIndex} onClick={open}>
              {l(GUIDE_COPY.open)}
            </button>
          </div>

          <button
            type="button"
            className={styles.tipClose}
            aria-label={l(GUIDE_COPY.faqClose)}
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
