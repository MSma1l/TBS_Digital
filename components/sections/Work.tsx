"use client";

import { useEffect, useState } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Lightbox } from "@/components/ui/Lightbox";
import { usePlatform } from "@/components/ui/usePlatform";
import { useAutoCarousel } from "@/components/ui/useAutoCarousel";
import { mediaUrl } from "@/lib/api";
import { useSiteContent, type ProjectItem } from "@/lib/siteContent";
import styles from "./Work.module.css";

/** How long each screenshot stays up before the card rotates to the next one. */
const ROTATE_MS = 3600;

/** Which image a card is currently showing. Rotation is paused while `paused`. */
function useGalleryRotation(count: number, paused: boolean): number {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % count),
      ROTATE_MS,
    );
    return () => window.clearInterval(id);
  }, [count, paused]);

  // A project whose gallery shrank (an image removed in the admin) must not keep
  // pointing past the end of the list.
  return index < count ? index : 0;
}

function ProjectCard({
  project,
  onOpen,
}: {
  project: ProjectItem;
  onOpen: (project: ProjectItem, index: number) => void;
}) {
  const platform = usePlatform();
  const [hovered, setHovered] = useState(false);
  const images = project.images;
  const index = useGalleryRotation(images.length, hovered);
  const hasImages = images.length > 0;

  // Show the store button that matches the device; on desktop (and before the platform
  // is known) offer both. A link that isn't set never renders a button.
  const showAppStore =
    Boolean(project.appStore) && (platform === "ios" || platform === "other");
  const showPlayStore =
    Boolean(project.playStore) && (platform === "android" || platform === "other");

  return (
    <Reveal className={styles.card}>
      <div
        className={styles.thumb}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {hasImages ? (
          <>
            <button
              type="button"
              className={styles.thumbBtn}
              onClick={() => onOpen(project, index)}
              aria-label={`Mărește imaginile proiectului ${project.name}`}
            >
              {images.map((src, i) => (
                // All the frames are stacked and cross-faded, so switching doesn't
                // re-request an image the visitor has already downloaded.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={mediaUrl(src)}
                  alt={`${project.name} — captură ${i + 1}`}
                  loading="lazy"
                  className={`${styles.shot} ${i === index ? styles.shotActive : ""}`}
                />
              ))}
              <span className={styles.zoom} aria-hidden>
                ⤢
              </span>
            </button>

            {images.length > 1 && (
              <div className={styles.dots} aria-hidden>
                {images.map((src, i) => (
                  <span
                    key={src}
                    className={`${styles.dot} ${i === index ? styles.dotOn : ""}`}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          // No screenshots yet (they get uploaded from the admin) — keep the card's
          // shape instead of collapsing it.
          <span className={`mono ${styles.noShots}`}>ÎN CURÂND</span>
        )}
      </div>

      <div className={styles.body}>
        {project.tag && (
          <span className={`mono ${styles.tag}`}>{project.tag}</span>
        )}
        <h3 className={styles.name}>{project.name}</h3>
        {project.desc && <p className={styles.desc}>{project.desc}</p>}

        <div className={styles.actions}>
          {project.url && (
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`mono ${styles.visit}`}
            >
              Vezi proiectul ↗
            </a>
          )}
          {showAppStore && (
            <a
              href={project.appStore}
              target="_blank"
              rel="noopener noreferrer"
              className={`mono ${styles.store}`}
            >
               App Store
            </a>
          )}
          {showPlayStore && (
            <a
              href={project.playStore}
              target="_blank"
              rel="noopener noreferrer"
              className={`mono ${styles.store}`}
            >
              ▶ Google Play
            </a>
          )}
        </div>
      </div>
    </Reveal>
  );
}

export function Work() {
  const { projects } = useSiteContent();
  // Mobile carousel: auto-rolls, pauses on manual slide (see the hook).
  const trackRef = useAutoCarousel(projects.length);

  // The open lightbox, if any: which project and which of its images.
  const [viewing, setViewing] = useState<{
    project: ProjectItem;
    index: number;
  } | null>(null);

  return (
    <section id="lucrari" className={styles.section}>
      <div className="container">
        <Reveal className={styles.head}>
          <SectionLabel index="/04">EXPERIENȚA NOASTRĂ</SectionLabel>
          <h2 className={`disp ${styles.title}`}>
            Proiecte pe care
            <br />
            le-am creat
          </h2>
          <p className={styles.lead}>
            O selecție din produsele digitale construite pentru clienți din
            diverse industrii.
          </p>
        </Reveal>

        <div ref={trackRef} className={styles.grid}>
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onOpen={(p, index) => setViewing({ project: p, index })}
            />
          ))}
        </div>

        {/* mobile-only affordance for the horizontal carousel (CSS-hidden on desktop) */}
        <p className={`mono ${styles.swipeHint}`} aria-hidden>
          ← GLISEAZĂ ↔ {projects.length} PROIECTE →
        </p>
      </div>

      {viewing && (
        <Lightbox
          images={viewing.project.images}
          index={viewing.index}
          title={viewing.project.name}
          onClose={() => setViewing(null)}
          onIndexChange={(index) =>
            setViewing((v) => (v ? { ...v, index } : v))
          }
        />
      )}
    </section>
  );
}
