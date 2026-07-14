"use client";

import { useEffect, useState } from "react";

export type Platform = "ios" | "android" | "other";

/**
 * The visitor's mobile platform, so a project card can offer the download link that
 * actually applies to the device in hand: an iPhone gets App Store, an Android phone
 * gets Google Play, and anything else (desktop) gets both.
 *
 * It stays `"other"` on the server and through the first client paint — `navigator` is
 * browser-only, and rendering the same markup on both sides is what keeps hydration
 * from mismatching. The real platform is filled in right after mount.
 */
export function usePlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>("other");

  useEffect(() => {
    const ua = navigator.userAgent;

    // iPadOS 13+ reports itself as a Mac; the touch-point count is what gives it away.
    const isIpadOS =
      /Macintosh/.test(ua) && typeof document !== "undefined" && navigator.maxTouchPoints > 1;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (/iPhone|iPad|iPod/.test(ua) || isIpadOS) setPlatform("ios");
    else if (/Android/.test(ua)) setPlatform("android");
  }, []);

  return platform;
}
