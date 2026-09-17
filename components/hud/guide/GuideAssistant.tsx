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
import { useLoc } from "@/lib/i18n/content";
import { INTRO_GONE_EVENT, isIntroOnScreen } from "@/lib/intro";
import { useRequestFlow, type RequestOptions } from "@/lib/request/RequestFlowProvider";
import { isPageCovered, subscribePageCover } from "@/lib/scrollLock";
import { useSiteContent, type ProjectItem } from "@/lib/siteContent";
import { visibleTimeout } from "@/lib/visibleTimeout";
import { GUIDE_COPY } from "./copy";
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

/** Entrance (`data-state="enter"`), matching the CSS animation's 0.7s. */
const ENTER_MS = 700;

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

  useEffect(() => {
    const id = window.setTimeout(() => setEntering(false), ENTER_MS);
    return () => window.clearTimeout(id);
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
      const bubble = tipRef.current?.getBoundingClientRect();
      const underTip = bubble !== undefined && overlaps(bubble, focused);
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

  const state = prompt !== null ? "prompt" : entering ? "enter" : "idle";
  const tabIndex = away ? -1 : 0;

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-hud=""
      data-guide=""
      data-state={state}
      data-away={away ? "" : undefined}
      data-yield={yielded ? "" : undefined}
      onKeyDown={onKeyDown}
    >
      <button
        ref={buttonRef}
        type="button"
        className={styles.avatar}
        data-testid="guide-avatar"
        aria-haspopup="dialog"
        aria-label={l(GUIDE_COPY.aria)}
        aria-describedby={prompt !== null ? tipId : undefined}
        tabIndex={tabIndex}
        onClick={() => open("guide")}
      >
        <span className={styles.scene} aria-hidden="true">
          <span className={styles.beam} />
          <span className={styles.body}>
            <span className={styles.face} data-face="front">
              <span className={styles.visor} />
            </span>
            <span className={styles.face} data-face="back" />
            <span className={styles.face} data-face="right" />
            <span className={styles.face} data-face="left" />
            <span className={styles.face} data-face="top" />
            <span className={styles.face} data-face="bottom" />
          </span>
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

      {prompt !== null && (
        <div ref={tipRef} className={styles.tip} data-testid="guide-tip">
          <p className={styles.tipKicker} aria-hidden="true">
            {l(GUIDE_COPY.label)}
          </p>
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
          <button
            type="button"
            className={styles.tipClose}
            aria-label={l(GUIDE_COPY.dismiss)}
            tabIndex={tabIndex}
            onClick={closeTip}
          >
            <X aria-hidden="true" strokeWidth={1.75} strokeLinecap="square" strokeLinejoin="miter" />
          </button>
        </div>
      )}
    </div>
  );
}
