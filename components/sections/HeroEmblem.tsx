"use client";

import { useEffect, useRef } from "react";
import styles from "./Hero.module.css";

/**
 * Interactive hero emblem — ports the prototype's `applyLogo()`:
 *  - the whole emblem rotates in 3D on scroll and tilts with the mouse
 *  - the wordmark shows only "TBS" at the top, then reveals " DIGITAL" as you scroll
 *  - the X/Y/Z HUD coordinates update live with scroll + pointer
 * The orbiting dots and spinning rings are pure CSS (see Hero.module.css).
 */
export function HeroEmblem() {
  const emblemRef = useRef<HTMLDivElement>(null);
  const digitalRef = useRef<HTMLSpanElement>(null);
  const cxRef = useRef<HTMLSpanElement>(null);
  const cyRef = useRef<HTMLSpanElement>(null);
  const czRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let scrollP = 0;
    let mx = 0;
    let my = 0;
    let raf = 0;

    const apply = () => {
      raf = 0;
      const p = scrollP;

      if (emblemRef.current && !reduce) {
        const tiltX = -my * 16;
        const tiltY = mx * 22;
        const scale = 1 - Math.min(p, 1) * 0.12;
        emblemRef.current.style.transform =
          `rotateX(${tiltX}deg) rotateY(${tiltY + p * 220}deg) ` +
          `rotateZ(${p * 140}deg) scale(${scale})`;
      }

      if (digitalRef.current && !reduce) {
        const dp = Math.min(1, p * 2.2);
        digitalRef.current.style.maxWidth = `${dp * 360}px`;
        digitalRef.current.style.opacity = String(dp);
      }

      if (cxRef.current) cxRef.current.textContent = (36.17 + mx * 10 + p * 4).toFixed(4);
      if (cyRef.current) cyRef.current.textContent = (-86.76 + my * 10 - p * 3).toFixed(4);
      if (czRef.current) czRef.current.textContent = (46.68 + p * 12).toFixed(4);
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };

    const onScroll = () => {
      const y = window.scrollY || 0;
      const vh = window.innerHeight || 1;
      scrollP = Math.min(1.4, y / vh);
      schedule();
    };

    const onMouse = (e: MouseEvent) => {
      if (reduce) return;
      mx = e.clientX / (window.innerWidth || 1) - 0.5;
      my = e.clientY / (window.innerHeight || 1) - 0.5;
      schedule();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mousemove", onMouse, { passive: true });
    onScroll(); // set initial state (collapses " DIGITAL" at the top)

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onMouse);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className={styles.emblemCol}>
      <div className={styles.emblemStage}>
        <div className={styles.emblemHalo} aria-hidden />

        <div className={`mono ${styles.hudCoords}`} aria-hidden>
          <div>
            X <span ref={cxRef} className={styles.hudVal}>36.1749</span>
          </div>
          <div>
            Y <span ref={cyRef} className={styles.hudVal}>-86.7676</span>
          </div>
          <div>
            Z <span ref={czRef} className={styles.hudVal}>46.6821</span>
          </div>
        </div>
        <div className={`mono ${styles.hudRender}`} aria-hidden>
          &gt;RENDERING... <span className={styles.hudValInline}>100%</span>
        </div>
        <div className={`mono ${styles.hudScan}`} aria-hidden>
          {"//SCN_01"}
        </div>

        <div ref={emblemRef} className={styles.emblem}>
          <div className={styles.ringDashed} />
          <div className={styles.ringSolid} />
          <div className={styles.ringInner} />
          <div className={styles.crossH} />
          <div className={styles.crossV} />
          <div className={styles.coreGlow} />
          <div className={styles.core}>
            <div className={styles.coreScan} />
            <span className={`disp ${styles.coreText}`}>TBS</span>
          </div>
          <div className={styles.orbitOuter}>
            <span className={styles.orbitDotOuter} />
          </div>
          <div className={styles.orbitInner}>
            <span className={styles.orbitDotInner} />
          </div>
        </div>
      </div>

      <div className={`disp ${styles.wordmark}`}>
        TBS
        <span ref={digitalRef} className={styles.wordmarkAccent}>
          &nbsp;DIGITAL
        </span>
      </div>
      <p className={`mono ${styles.scrollHint}`}>
        DERULEAZĂ — SISTEMUL SE ACTIVEAZĂ ↓
      </p>
    </div>
  );
}
