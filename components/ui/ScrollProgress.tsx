"use client";

import { useEffect, useRef } from "react";

/** Thin gradient bar pinned to the top of the viewport that fills as you scroll. */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = window.scrollY || 0;
      const vh = window.innerHeight || 1;
      const docH = document.documentElement.scrollHeight - vh || 1;
      if (ref.current) {
        ref.current.style.width = `${Math.min(100, (y / docH) * 100)}%`;
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <div data-progress ref={ref} />;
}
