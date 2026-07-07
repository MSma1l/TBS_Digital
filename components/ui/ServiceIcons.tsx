import type { ReactElement } from "react";

/**
 * Line icons for the service cards, ported from the design prototype.
 * Keyed by service id (see lib/content.ts).
 */
const svgProps = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const serviceIcons: Record<string, ReactElement> = {
  landing: (
    <svg {...svgProps}>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <line x1="3" y1="9" x2="21" y2="9" />
    </svg>
  ),
  site: (
    <svg {...svgProps}>
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  ),
  shop: (
    <svg {...svgProps}>
      <circle cx="9" cy="20" r="1.3" />
      <circle cx="18" cy="20" r="1.3" />
      <path d="M2 3h3l2.4 12h11l2-8H6.2" />
    </svg>
  ),
  mobile: (
    <svg {...svgProps}>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <line x1="11" y1="18" x2="13" y2="18" />
    </svg>
  ),
  crm: (
    <svg {...svgProps}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20a5.5 5.5 0 0111 0" />
      <path d="M16 6a3 3 0 010 6" />
      <path d="M18 20a5 5 0 00-3-4.6" />
    </svg>
  ),
  saas: (
    <svg {...svgProps}>
      <path d="M12 3l8 4-8 4-8-4z" />
      <path d="M4 12l8 4 8-4" />
      <path d="M4 16.5l8 4 8-4" />
    </svg>
  ),
  automation: (
    <svg {...svgProps}>
      <path d="M4 12a8 8 0 0113.5-5.8" />
      <path d="M20 12a8 8 0 01-13.5 5.8" />
      <path d="M18 3v3.5h-3.5" />
      <path d="M6 21v-3.5h3.5" />
    </svg>
  ),
  dashboard: (
    <svg {...svgProps}>
      <line x1="4" y1="20" x2="4" y2="11" />
      <line x1="10" y1="20" x2="10" y2="4" />
      <line x1="16" y1="20" x2="16" y2="13" />
      <line x1="21" y1="20" x2="3" y2="20" />
    </svg>
  ),
  bot: (
    <svg {...svgProps}>
      <rect x="5" y="8" width="14" height="10" rx="2" />
      <circle cx="9.5" cy="13" r="1" />
      <circle cx="14.5" cy="13" r="1" />
      <line x1="12" y1="4" x2="12" y2="8" />
      <circle cx="12" cy="3.5" r="1" />
    </svg>
  ),
  custom: (
    <svg {...svgProps}>
      <polyline points="8 8 4 12 8 16" />
      <polyline points="16 8 20 12 16 16" />
      <line x1="13.5" y1="6" x2="10.5" y2="18" />
    </svg>
  ),
};

/** Fallback icon for services added from the admin (unknown ids). */
export const defaultServiceIcon: ReactElement = (
  <svg {...svgProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 113.5 2.3c-.8.4-1 .8-1 1.7" />
    <line x1="12" y1="16.5" x2="12" y2="16.6" />
  </svg>
);

export const iconFor = (id: string): ReactElement =>
  serviceIcons[id] ?? defaultServiceIcon;
