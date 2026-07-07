"use client";

import { useEffect, useRef, type ReactNode, type CSSProperties } from "react";

/**
 * Scroll-reveal wrapper. Elements start hidden (via [data-reveal] in globals.css)
 * and get the `rv-in` class when they scroll into view. A single shared
 * IntersectionObserver handles every reveal on the page.
 */
let sharedObserver: IntersectionObserver | null = null;

function getObserver(): IntersectionObserver | null {
  if (typeof window === "undefined") return null;
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("rv-in");
            sharedObserver?.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
  }
  return sharedObserver;
}

type RevealProps = {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  id?: string;
};

export function Reveal({ children, className, style, id }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = getObserver();
    if (observer) observer.observe(el);
    else el.classList.add("rv-in");
    return () => {
      if (observer && el) observer.unobserve(el);
    };
  }, []);

  return (
    <div ref={ref} data-reveal className={className} style={style} id={id}>
      {children}
    </div>
  );
}
