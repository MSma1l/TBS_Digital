import type { ReactElement } from "react";
import type { SocialNetwork } from "@/lib/content";

/**
 * Line icons for the social links (team cards, footer).
 *
 * Same conventions as `ServiceIcons.tsx`: inline SVG, `currentColor`, one 24×24
 * viewBox, stroked rather than filled — no icon library and no external request
 * (the CSP blocks them). Size is inherited from the caller's CSS: the svg is
 * laid out at 100% of its box, so the parent decides how big an icon is.
 */
const svgProps = {
  width: "100%",
  height: "100%",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

export const socialIcons: Record<SocialNetwork, ReactElement> = {
  website: (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z" />
    </svg>
  ),
  linkedin: (
    <svg {...svgProps}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7.5 10.5V17" />
      <path d="M7.5 7.4v.1" />
      <path d="M11.5 17v-6.5" />
      <path d="M11.5 13.6a3 3 0 0 1 5.5-1.6V17" />
    </svg>
  ),
  instagram: (
    <svg {...svgProps}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M16.9 7.1v.1" />
    </svg>
  ),
  facebook: (
    <svg {...svgProps}>
      <path d="M17 3h-2.5A4.5 4.5 0 0 0 10 7.5V10H7v4h3v7h4v-7h3l.5-4H14V7.6a.6.6 0 0 1 .6-.6H17z" />
    </svg>
  ),
  github: (
    <svg {...svgProps}>
      <path d="M9 19.5c-4.5 1.4-4.5-2.3-6.3-2.8m12.6 5.3v-3.6a3.1 3.1 0 0 0-.9-2.4c2.9-.3 5.9-1.4 5.9-6.4a5 5 0 0 0-1.4-3.5a4.6 4.6 0 0 0-.1-3.5s-1.1-.3-3.6 1.4a12.3 12.3 0 0 0-6.4 0C6.2 2.3 5.1 2.6 5.1 2.6a4.6 4.6 0 0 0-.1 3.5a5 5 0 0 0-1.4 3.5c0 5 3 6.1 5.9 6.4a3.1 3.1 0 0 0-.9 2.4v3.6" />
    </svg>
  ),
  telegram: (
    <svg {...svgProps}>
      <path d="M21.6 4.3 2.9 11.4a.4.4 0 0 0 0 .8l4.9 1.6 1.8 5.4a.4.4 0 0 0 .7.1l2.6-2.9 4.6 3.4a.4.4 0 0 0 .6-.2l3.1-14.8a.4.4 0 0 0-.6-.5z" />
      <path d="m7.8 13.8 10.4-7.6-7.9 8.9" />
    </svg>
  ),
};

/** Display name of each network, used to build the links' accessible names. */
export const socialNames: Record<SocialNetwork, string> = {
  website: "Website",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  github: "GitHub",
  telegram: "Telegram",
};
