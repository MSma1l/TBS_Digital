"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { useOffscreenAttribute } from "@/components/fx/useOffscreenAttribute";
import { Reveal } from "@/components/ui/Reveal";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import styles from "./Process.module.css";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

type Step = { title: LocalizedText };

/*
 * "Cum începem": the three-step plan (docs/16, "Copy framework"), placed right above the request
 * section where the first one is taken. Step 02 promises one business day and nothing faster —
 * the reply time the estimator's sent screen (`SENT_COPY`) and the guide's FAQ already promise.
 */
const STEPS: Step[] = [
  {
    title: L("Ne spui ideea", "Рассказываете идею", "Tell us the idea") },
  {
    title: L("Primești planul și prețul", "Получаете план и цену", "Get the plan and the price") },
  {
    title: L("Lansezi și crești", "Запускаете и растёте", "Launch and grow") },
];

const SECTION = {
  title: L("Un plan simplu, în trei pași.", "Простой план из трёх шагов.", "A simple plan in three steps."),
};

/*
 * Step 02's promise drawn as a part on the wire: a chip sitting on the trace at pad 02 (the
 * stylesheet places it). It is the step's own title in short, so it is there for the eye only —
 * read aloud it would be the same promise twice, the second time as "less than or equal to one".
 */
const REPLY_CHIP = L("≤ 1 zi lucrătoare", "≤ 1 рабочего дня", "≤ 1 business day");
/** The step that carries the chip: 02, the reply. */
const CHIP_STEP = 1;

/*
 * An ordered list, because the order is the content, hung on ONE circuit trace that the
 * stylesheet draws: a square pad for each step, the runs between them, and past the last pad a
 * drop that ends in an arrowhead pointing down at the request form. "De ce TBS" right above is a
 * row of four cards; this section was once a second one, and the two read as the same thing twice.
 *
 * All of the circuit is decoration — pseudo-elements, or empty elements under one `aria-hidden` —
 * so a listener gets three plain steps. The number is text, not decoration: `list-style: none`
 * hides the list's own numbering, and VoiceOver drops the list role along with it, so "01" is what
 * tells a listener which step this is, and it is read once, since no marker is drawn beside it.
 */
export function Process() {
  const l = useLoc();
  const boardRef = useRef<HTMLDivElement>(null);

  /*
   * THE BOARD LIGHTS ONCE, WHEN IT IS REACHED — the footer's ignition (Footer.tsx), with one
   * difference. A board that is off screen when the page wakes up is ARMED — its trace dim, its
   * pads off, its words held back — and the first time it comes well into the window it ENTERS:
   * the stylesheet grows the light from 01 to the arrow and switches each pad and its words on as
   * the light reaches them. The difference: a board already on screen is never armed, only
   * entered. The visitor has seen it finished, and it does not go dark again to put on a show.
   * With no IntersectionObserver it simply enters, and without JavaScript nothing is ever armed,
   * so the server's markup is the finished board, never a dark one.
   * `data-entered` is a latch that disconnects itself: nothing replays on a scroll back up.
   */
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const light = () => board.setAttribute("data-entered", "");
    if (typeof IntersectionObserver === "undefined") {
      light();
      return;
    }
    const box = board.getBoundingClientRect();
    if (box.bottom > 0 && box.top < window.innerHeight) {
      light();
      return;
    }
    board.setAttribute("data-armed", "");
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        light();
        observer.disconnect();
      },
      // The bottom fifth of the window does not count: the light starts where it is seen, not
      // while the board is still a line along the bottom edge.
      { rootMargin: "0px 0px -20% 0px" },
    );
    observer.observe(board);
    return () => observer.disconnect();
  }, []);

  /* The one pulse that then runs the trace waits while the board is well off screen
     (`data-offscreen`). A second observer, because the latch above stops listening once it has
     fired and could never report the board leaving. */
  useOffscreenAttribute(boardRef);

  return (
    <section id="proces" className={styles.section}>
      <div className="container">
        <Reveal className={styles.head}>
          <h2 className={`disp ${styles.title}`}>{l(SECTION.title)}</h2>
        </Reveal>

        <div ref={boardRef} className={styles.board}>
          <ol className={styles.steps}>
            {STEPS.map((step, i) => (
              <li
                key={i}
                className={styles.step}
                style={
                  {
                    /* This step's place on the trace, as a plain number: its pad and its words
                       come on `--step` runs after the first. */
                    "--step": i,
                  } as CSSProperties
                }
              >
                <span className={`mono ${styles.node}`}>{String(i + 1).padStart(2, "0")}</span>
                <h3 className={`disp ${styles.stepTitle}`}>{l(step.title)}</h3>
                {i === CHIP_STEP && (
                  <span className={`mono ${styles.chip}`} aria-hidden="true">
                    {l(REPLY_CHIP)}
                  </span>
                )}
              </li>
            ))}
          </ol>

          {/* The rest of the trace: the 45° bend (from 1025px), the drop, the arrowhead dim and
              lit, and the pulse's two runs. Empty boxes the stylesheet draws, and silent. */}
          <div className={styles.wires} aria-hidden="true">
            <span className={styles.bend} />
            <span className={styles.drop} />
            <span className={styles.arrow} />
            <span className={`${styles.arrow} ${styles.arrowLit}`} />
            <span className={styles.pulse}>
              <span className={styles.run}>
                <span className={styles.spark} />
              </span>
              <span className={styles.runDrop}>
                <span className={styles.spark} />
              </span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
