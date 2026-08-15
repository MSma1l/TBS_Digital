import type { MessageKey } from "@/lib/i18n/messages";

/**
 * The "choose a direction" buttons on the /02 block. Each opens its own page at
 * /solutions/<slug> (a placeholder for now). Labels come from the message catalog so
 * the buttons stay trilingual.
 */
export type Direction = { slug: string; labelKey: MessageKey };

export const directions: Direction[] = [
  { slug: "digital", labelKey: "dir.digital" },
  { slug: "ecommerce", labelKey: "dir.ecommerce" },
  { slug: "automation", labelKey: "dir.automation" },
  { slug: "ai", labelKey: "dir.ai" },
  { slug: "brand", labelKey: "dir.brand" },
];
