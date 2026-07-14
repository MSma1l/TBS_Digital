"use client";

import { useCallback, useEffect } from "react";
import { mediaUrl } from "@/lib/api";
import styles from "./Lightbox.module.css";

/**
 * Full-screen image viewer for a project's gallery.
 *
 * Opens on the image the visitor clicked and steps through the rest with the arrow
 * keys or the on-screen controls. Escape (or a click on the backdrop) closes it. While
 * it is open the page behind it can't scroll, so the wheel doesn't move the page under
 * the overlay.
 */
export function Lightbox({
  images,
  index,
  title,
  onClose,
  onIndexChange,
}: {
  images: string[];
  /** Index of the image currently shown. */
  index: number;
  /** Project name — used for the alt text and the caption. */
  title: string;
  onClose: () => void;
  onIndexChange: (next: number) => void;
}) {
  const count = images.length;

  const step = useCallback(
    (delta: number) => onIndexChange((index + delta + count) % count),
    [index, count, onIndexChange],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);

    // Freeze the page behind the overlay, and restore whatever overflow it had.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, step]);

  if (count === 0) return null;

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} — imagine ${index + 1} din ${count}`}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Închide"
        className={`mono ${styles.close}`}
      >
        ✕
      </button>

      {/* Clicks inside the figure must not reach the backdrop's close handler. */}
      <figure className={styles.figure} onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mediaUrl(images[index])}
          alt={`${title} — captură ${index + 1}`}
          className={styles.image}
        />
        <figcaption className={`mono ${styles.caption}`}>
          {title} · {index + 1}/{count}
        </figcaption>
      </figure>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              step(-1);
            }}
            aria-label="Imaginea anterioară"
            className={`${styles.nav} ${styles.prev}`}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              step(1);
            }}
            aria-label="Imaginea următoare"
            className={`${styles.nav} ${styles.next}`}
          >
            ›
          </button>
        </>
      )}
    </div>
  );
}
