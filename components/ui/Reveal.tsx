"use client";

import {
  useEffect,
  useRef,
  type ReactNode,
  type CSSProperties,
} from "react";

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
  /** When set, the reveal target becomes a real <button> that runs this on click. */
  onClick?: () => void;
  /** Accessible name for the button variant. */
  ariaLabel?: string;
};

export function Reveal({
  children,
  className,
  style,
  id,
  onClick,
  ariaLabel,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);

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

  // Interactive reveals render as a <button> (native click + keyboard + focus), so the
  // card is a real control, not a div with a click handler. `:nth-child` in the grid CSS
  // counts elements regardless of tag, so the hue rotation is unaffected.
  if (onClick) {
    return (
      <button
        ref={ref as React.RefObject<HTMLButtonElement>}
        type="button"
        data-reveal
        className={className}
        style={style}
        id={id}
        onClick={onClick}
        aria-label={ariaLabel}
      >
        {children}
      </button>
    );
  }

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      data-reveal
      className={className}
      style={style}
      id={id}
    >
      {children}
    </div>
  );
}
