"use client";

import { useEffect, useRef } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { iconFor } from "@/components/ui/ServiceIcons";
import { useSiteContent } from "@/lib/siteContent";
import styles from "./Services.module.css";

/** Auto-advance interval for the mobile carousel (ms). */
const ROLL_MS = 2000;

export function Services() {
  const { services } = useSiteContent();
  const cards = services.filter((s) => !s.estimatorOnly);
  const trackRef = useRef<HTMLDivElement>(null);

  /*
   * Mobile only: auto-roll the carousel one card every ~2s. Off on desktop
   * (the grid isn't a scroller there) and when the user prefers reduced motion.
   * Pauses while the user is touching/dragging and resumes shortly after, so it
   * never fights a manual swipe.
   */
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const mqMobile = window.matchMedia("(max-width: 640px)");
    const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    let timer: number | undefined;
    let resumeTimer: number | undefined;
    let index = 0;
    let paused = false;

    const items = () => Array.from(track.children) as HTMLElement[];

    // In a horizontal scroller, off-screen cards never intersect the viewport,
    // so the scroll-reveal would leave them hidden. Reveal them all up front.
    const revealAll = () => items().forEach((c) => c.classList.add("rv-in"));

    const centerOn = (i: number) => {
      const el = items()[i];
      if (!el) return;
      const target = el.offsetLeft - (track.clientWidth - el.clientWidth) / 2;
      track.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
    };

    const nearestIndex = () => {
      const center = track.scrollLeft + track.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;
      items().forEach((c, i) => {
        const d = Math.abs(c.offsetLeft + c.clientWidth / 2 - center);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      return best;
    };

    const tick = () => {
      if (paused) return;
      const n = items().length;
      if (n < 2) return;
      index = (index + 1) % n;
      centerOn(index);
    };

    const stop = () => {
      if (timer) window.clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      stop();
      if (!mqMobile.matches) return;
      revealAll();
      if (mqReduce.matches) return; // visible, just not auto-rolling
      timer = window.setInterval(tick, ROLL_MS);
    };

    const pause = () => {
      paused = true;
      if (resumeTimer) window.clearTimeout(resumeTimer);
    };
    const scheduleResume = () => {
      if (resumeTimer) window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => {
        index = nearestIndex(); // continue from where the user left off
        paused = false;
      }, ROLL_MS + 1500);
    };

    const onVisibility = () => (document.hidden ? stop() : start());
    const onMqChange = () => start();

    track.addEventListener("pointerdown", pause);
    track.addEventListener("touchstart", pause, { passive: true });
    track.addEventListener("pointerup", scheduleResume);
    track.addEventListener("touchend", scheduleResume, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    mqMobile.addEventListener("change", onMqChange);
    mqReduce.addEventListener("change", onMqChange);

    start();

    return () => {
      stop();
      if (resumeTimer) window.clearTimeout(resumeTimer);
      track.removeEventListener("pointerdown", pause);
      track.removeEventListener("touchstart", pause);
      track.removeEventListener("pointerup", scheduleResume);
      track.removeEventListener("touchend", scheduleResume);
      document.removeEventListener("visibilitychange", onVisibility);
      mqMobile.removeEventListener("change", onMqChange);
      mqReduce.removeEventListener("change", onMqChange);
    };
  }, [cards.length]);

  return (
    <section id="servicii" className="section">
      <div className="container">
        <Reveal className={styles.head}>
          <SectionLabel index="/03">CE PUTEM FACE</SectionLabel>
          <h2 className={`disp ${styles.title}`}>
            Servicii de
            <br />
            digitalizare
          </h2>
          <p className={styles.lead}>
            Alege un serviciu sau combină mai multe într-un produs complet.
          </p>
        </Reveal>

        <div ref={trackRef} className={styles.grid}>
          {cards.map((s, i) => (
            <Reveal key={s.id} className={styles.card}>
              <div className={`mono ${styles.num}`}>
                /{String(i + 1).padStart(2, "0")}
              </div>
              <div className={styles.icon}>{iconFor(s.id)}</div>
              <h3 className={`mono ${styles.name}`}>{s.name}</h3>
              <p className={styles.desc}>{s.desc}</p>
            </Reveal>
          ))}
        </div>

        {/* mobile-only affordance for the horizontal carousel (CSS-hidden on desktop) */}
        <p className={`mono ${styles.swipeHint}`} aria-hidden>
          ← GLISEAZĂ ↔ {cards.length} SERVICII →
        </p>
      </div>
    </section>
  );
}
