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
} from "react";
import { CONSENT_EVENT, getConsent } from "@/lib/consent";
import { directions } from "@/lib/directions";
import { overlaps } from "@/lib/hud/obscure";
import { useLoc } from "@/lib/i18n/content";
import { INTRO_GONE_EVENT, isIntroOnScreen } from "@/lib/intro";
import { useRequestFlow } from "@/lib/request/RequestFlowProvider";
import { isPageCovered, subscribePageCover } from "@/lib/scrollLock";
import { GUIDE_COPY, GUIDE_FAQ } from "./copy";
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

/** How long her mouth keeps moving after an answer comes up. */
const SAY_MS = 7000;

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
      {/* BEFORE the wash, not after. The scanlines multiply into whatever is under them, so
          anything painted on top of them arrives as a smooth blotch on a rastered face — the one
          thing that would give the whole trick away. */}
      {/* THE ORDER IS THE DESIGN. The dark interior and the teeth are painted FIRST and her own
          lower lip is laid over them, covering them completely while her mouth is shut. The lip
          then travels down and uncovers exactly as much as it moved — which is what a mouth
          does, and why nothing here is ever drawn on top of a closed mouth. */}
      <span className={styles.mouth}>
        <span className={styles.teeth} />
      </span>
      {/* The same order, one lip up: the strip above the seam is painted here and her own upper
          lip is laid over it, so that one too is uncovered by a lip travelling off it and never
          drawn onto a mouth that is shut. */}
      <span className={styles.mouthTop} />
      <span className={styles.jaw} />
      <span className={styles.upperLip} />
      {/* The crease under the lip deepens as it goes, and travels with it. */}
      <span className={styles.lipShade} />
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
   * `talking` is not WHAT she says — the bubble renders the answer from `asked`. It is only
   * whether she is speaking it, which the jaw animation keys off (`data-say`). It counts up
   * rather than toggling so that a second question RESTARTS the clock below instead of
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
   * SHE STOPS TALKING BEFORE THE ANSWER GOES AWAY, and the two are deliberately not the same
   * clock. The ANSWER stays on screen for as long as the visitor wants it (it renders from
   * `asked`); her mouth runs for seven seconds, which is about as long as reading one out loud
   * takes. A mouth still moving under a paragraph nobody is reading any more is the thing that
   * would make her look like a puppet.
   */
  useEffect(() => {
    if (talking === 0) return;
    const id = window.setTimeout(() => setTalking(0), SAY_MS);
    return () => window.clearTimeout(id);
  }, [talking]);

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
