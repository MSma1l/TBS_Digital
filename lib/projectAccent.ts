/**
 * Each project's two brand colours: the gradient its card is drawn in on Home's /04 grid
 * (components/sections/Work.tsx) and the colour its pixel lights in on /portofoliu
 * (components/sections/Portfolio.tsx) — one table, so a project is the same colour everywhere.
 *
 * Presentation only: the *content* (names, tags, descriptions, links, screenshots) comes from
 * the store, while these are part of the design. Keyed by project id so a project keeps its
 * colours no matter where it lands in the order. A project the admin adds falls back to a
 * palette entry picked by position, so it is still a finished, coloured thing — never a blank.
 *
 * Raw hex on purpose: these are per-project brand colours, not theme tokens, and they reach
 * the page as inline custom properties (`--p1` / `--p2`), never as class names.
 */
const GRADIENTS: Record<string, readonly [string, string]> = {
  bizcheck: ["#192f6f", "#4b7dff"],
  "itara-global": ["#173b3d", "#10a99b"],
  docusafe: ["#6d2348", "#e5527d"],
  "crowe-portal": ["#1b2a52", "#3f63d8"],
  cgam: ["#53397d", "#9671dd"],
  "iq-arena": ["#734328", "#e38a4f"],
  "balloons-breeze": ["#3a1c10", "#b3801f"],
  "statistica-md": ["#0d3a7a", "#1f6fd0"],
  statistic: ["#0f2a52", "#3f7fe0"],
  flirt: ["#1a0510", "#ff2d78"],
};

const FALLBACK_GRADIENTS: readonly (readonly [string, string])[] = [
  ["#192f6f", "#4b7dff"],
  ["#173b3d", "#10a99b"],
  ["#53397d", "#9671dd"],
  ["#734328", "#e38a4f"],
  ["#6d2348", "#e5527d"],
];

/** `[deep, bright]` for `project`; `position` is its index in the list (the fallback's pick). */
export function projectGradient(
  project: { id: string },
  position: number,
): readonly [string, string] {
  return GRADIENTS[project.id] ?? FALLBACK_GRADIENTS[position % FALLBACK_GRADIENTS.length];
}
