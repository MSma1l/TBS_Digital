import type { CSSProperties } from "react";
import s from "./Loading.module.css";

/** Where the four corner brackets sit in the view box, and how long each arm is. */
const CORNERS = [
  { x: -30, y: -30, dx: 1, dy: 1 },
  { x: 30, y: -30, dx: -1, dy: 1 },
  { x: 30, y: 30, dx: -1, dy: -1 },
  { x: -30, y: 30, dx: 1, dy: -1 },
] as const;
const ARM = 12;

export type LoadingSize = "sm" | "md" | "lg" | "fill";

export type LoadingProps = {
  /**
   * `sm` beside a line of text, `md` inside a panel, `lg` as a section's placeholder, `fill` to
   * take the box the caller gives it (position that box yourself).
   */
  size?: LoadingSize;
  /**
   * The accessible name, from the message catalog — e.g. `t("common.loading")`. With a label the
   * mark becomes a live region, so assistive tech is told something is in flight. WITHOUT one it
   * is purely decorative and `aria-hidden`, which is what a scene host wants: the box it covers
   * is already `aria-hidden` and a second announcement would be noise.
   */
  label?: string;
  /** Positioning and any gating the caller owns (a scene host makes it `absolute inset-0`). */
  className?: string;
};

/**
 * The site's one loading mark — anything that is not ready yet, whatever the reason: data in
 * flight, a WebGL scene still compiling, a panel waiting on a fetch.
 *
 * Deliberately NOT a spinner. Every surface on this site is drawn with HUD corner brackets and a
 * scanning bar, so waiting is drawn the same way: a frame, a bar sweeping between its corners, and
 * a red core, red being the live thing everywhere else here. Seven elements and one `<svg>`;
 * transform, opacity and dash offset only, so it stays on the compositor at exactly the moment the
 * main thread is busiest. That is also why it is CSS and never a second canvas.
 *
 * It carries no copy of its own: `label` comes from the catalog, so nothing here has to be
 * translated and a decorative use costs no key at all.
 *
 * `data-loading` is the stable hook for callers that gate it from the outside (the scene hosts
 * hold it on `[data-renderer="pending"]`, and the `<noscript>` rule in `app/(site)/layout.tsx`
 * takes it away where no decision ever comes).
 */
export function Loading({ size = "md", label, className }: LoadingProps) {
  return (
    <svg
      data-loading=""
      viewBox="-50 -50 100 100"
      preserveAspectRatio="xMidYMid meet"
      focusable="false"
      className={[s.loading, s[size], className].filter(Boolean).join(" ")}
      {...(label
        ? { role: "status" as const, "aria-live": "polite" as const, "aria-label": label }
        : { "aria-hidden": true as const })}
    >
      {CORNERS.map((c, i) => (
        <path
          key={i}
          d={`M${c.x} ${c.y + c.dy * ARM}V${c.y}H${c.x + c.dx * ARM}`}
          className={s.bracket}
          style={{ "--i": i } as CSSProperties}
        />
      ))}
      <path d="M-22 0H22" className={s.scan} />
      <path d="M0-12 0 12" className={s.core} />
    </svg>
  );
}
