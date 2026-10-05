"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentPropsWithoutRef } from "react";
import { splitLocalePath } from "@/lib/i18n/locales";

/**
 * A link in the site's chrome — the header menu and the footer columns, both of which are on
 * every page.
 *
 * A `/#section` href is a section of Home. On Home itself it renders as the plain in-page anchor
 * (`#section`): the browser's own fragment navigation, exactly what these links always were —
 * the page's smooth scroll, `:target`, the focus starting point. Anywhere else it is a client
 * navigation to Home that lands on the section. It used to be the bare `#section` on every page,
 * so on a service page "Companie" and "Despre" pointed at ids that page does not have and did
 * nothing at all (2026-10-03).
 *
 * Any other `/` route is a `Link`; everything else (an anchor that exists on every page, such as
 * the footer's `#parteneri`) stays a plain anchor. `/ru` and `/en` are Home too, under a language
 * prefix. With no router at all (a unit test rendering the header alone) nothing is Home.
 */
export function SiteLink({ href, ...rest }: ComponentPropsWithoutRef<"a"> & { href: string }) {
  const pathname = usePathname();
  const onHome = pathname !== null && splitLocalePath(pathname).rest === "/";
  if (href.startsWith("/#") && onHome) return <a href={href.slice(1)} {...rest} />;
  if (href.startsWith("/")) return <Link href={href} {...rest} />;
  return <a href={href} {...rest} />;
}
