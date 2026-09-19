"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { navMenu, type NavItem } from "@/lib/content";
import { useT } from "@/lib/i18n/LanguageProvider";
import { useRequestFlow } from "@/lib/request/RequestFlowProvider";
import { lockRootScroll } from "@/lib/scrollLock";
import { shouldInterceptTap } from "@/lib/tapIntent";
import { PreferencesGroup } from "@/components/ui/PreferencesGroup";
import { HeaderClock } from "./HeaderClock";
import { useHeaderCondensed } from "./useHeaderCondensed";

/** Sentence-cases a catalog label ("SERVICII" → "Servicii") for the overlay's large links. */
const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/**
 * The width from which the desktop menu replaces the burger — the complement of the
 * `max-width: 860px` rules everywhere else, and Tailwind's `md:` here. An overlay still open
 * when the viewport grows past it (rotation, a resized window) is closed.
 */
const DESKTOP_QUERY = "(min-width: 861px)";

/** One keyboard focus ring for every control in the bar and the overlay. */
const FOCUS_RING_CLASSES =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan";

/**
 * A submenu entry. Since the Services submenu started pointing at the real
 * `/servicii/<slug>` pages, half these hrefs are routes and half are still same-page
 * anchors — so the element is chosen per href: `Link` for a route (client-side navigation
 * and prefetch), a plain anchor for a hash, which `Link` would only complicate.
 */
function NavChildLink({
  href,
  className,
  onClick,
  children,
}: {
  href: string;
  className: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return href.startsWith("/") ? (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  ) : (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}

/**
 * Public navigation. It deliberately carries **no link to the admin panel**: the admin
 * reaches `/admin-tbs-digital` by typing the URL. A button here would have published the
 * admin's path in the markup of every page — handing it to anyone scraping the site.
 *
 * The HUD header, in Tailwind (`app/tailwind.css`). DOM order is part of the contract that
 * the unit and E2E suites read: the logo is the first link, then the clock, then the
 * desktop `<nav>`, then the actions — preferences, the CTA as the group's very next
 * sibling, the burger. Nothing is added to the phone row, which is measured to fit 320px.
 *
 * `data-intro-reveal="header"` marks the `<header>` for the intro's page entrance, which
 * animates ONLY its transform: opacity or a filter on the header would make it the backdrop
 * root of its own glass and switch the blur off mid-entrance. No CSS rule may target the
 * attribute — without an intro nothing is hidden.
 *
 * ## The bar condenses on scroll
 *
 * At the top of the page the header is a full-width glass bar with a red hairline under it.
 * Once the visitor scrolls (`useHeaderCondensed`, two states with hysteresis) it condenses
 * into a **floating rounded island**: inset from the window's edges, 16px corners, a
 * hairline ring and a drop shadow, its red underline pulled in from the edges.
 *
 * What makes that safe is the split between the BOX and the PAINT:
 *  · the `<header>` itself keeps the exact height it always had — 13px + the 44px tap-target
 *    row + 13px + a 1px border (`--header-h`, 77px in the 641–860px band where the language
 *    group is taller). `--header-h` is read in twenty places, `scrollProbe.readHeaderHeight`
 *    first among them, and it feeds the 3D stage's sticky layer, the helix's zone, the steps
 *    corner and the spiral's spans. A header whose layout height moved with the scroll would
 *    drag the whole scene up and down every frame;
 *  · everything painted — the glass, the ring, the shadow, the red line — lives on ONE
 *    absolutely positioned sibling of the content row (`[data-header-bar]`). It is out of
 *    flow, so its insets and its radius animate without re-laying out a single thing outside
 *    the header, and the reserved box never moves.
 *
 * The glass stays on that element and never on the `<header>`: a backdrop-filter on the
 * header would make it the backdrop root, and the glass dropdowns inside it would have
 * nothing left to blur.
 */
export function Navbar() {
  const t = useT();
  const { openRequest } = useRequestFlow();
  const condensed = useHeaderCondensed();
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);
  const menuId = useId();

  /* The burger is where focus came from when the overlay opened, and — unlike the overlay's
     own CTA — it is still in the DOM after the menu closes. It is therefore the element the
     shared dialog must hand focus back to when it was opened from inside the menu. */
  const burgerRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // --- desktop dropdowns ------------------------------------------------------------------
  /* CSS opens a dropdown on its own (the `menu-open` variant: real hover, focus-within, or
     `data-open`), before hydration and without JavaScript. The state below only adds what
     CSS cannot know: `aria-expanded`, the first touch tap (`data-open`) and Escape
     (`data-dismissed`, which beats all three). Keys are the catalog keys of the items. */
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [touchOpen, setTouchOpen] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  /** The pointer behind the next click: "mouse" | "touch" | "pen", or "keyboard". */
  const pointerKind = useRef("");

  const expanded = (key: string) =>
    dismissed !== key && (hovered === key || focused === key || touchOpen === key);

  /* A tap-opened dropdown closes on a press anywhere outside its own item. Capture phase, so
     it lands before the press reaches whatever was pressed (another item's link included,
     which then opens its own). */
  useEffect(() => {
    if (touchOpen === null) return;
    const onPointerDown = (event: PointerEvent) => {
      const item =
        event.target instanceof Element ? event.target.closest("[data-menu-item]") : null;
      if (item?.getAttribute("data-menu-item") === touchOpen) return;
      setTouchOpen(null);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [touchOpen]);

  /** Close one dropdown for good (until the pointer or focus comes back to its item). */
  const dismiss = (key: string) => {
    setDismissed(key);
    setTouchOpen(null);
  };

  /* Escape also closes a dropdown the MOUSE opened, wherever focus is (on <body>, somewhere
     in the page): WCAG 1.4.13 wants hover content dismissible without moving the pointer or
     focus. Focus stays where it is. With focus inside the item, the item's own
     onKeyDown below has already handled the key — React's root listener runs before this
     one on `document` and marks it `defaultPrevented` — so it is not handled twice. */
  useEffect(() => {
    if (hovered === null || !navMenu.some((item) => item.key === hovered && item.children)) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      setDismissed(hovered);
      setTouchOpen(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [hovered]);

  const itemHandlers = (item: NavItem) => ({
    onPointerEnter: (event: { pointerType: string }) => {
      if (event.pointerType !== "mouse") return;
      setHovered(item.key);
      // Coming back to an item re-opens what Escape or a click closed.
      setDismissed((d) => (d === item.key ? null : d));
    },
    onPointerLeave: (event: { pointerType: string }) => {
      if (event.pointerType !== "mouse") return;
      setHovered((h) => (h === item.key ? null : h));
    },
    onFocus: () => setFocused(item.key),
    onBlur: (event: ReactFocusEvent<HTMLDivElement>) => {
      const next = event.relatedTarget as Node | null;
      if (next && event.currentTarget.contains(next)) return;
      setFocused((f) => (f === item.key ? null : f));
      setDismissed((d) => (d === item.key ? null : d));
      setTouchOpen((o) => (o === item.key ? null : o));
    },
    /* Escape closes an open dropdown and puts focus on its top link (WCAG 1.4.13: content
       shown on hover or focus is dismissible without moving the pointer or focus away). */
    onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => {
      pointerKind.current = "keyboard";
      if (event.key !== "Escape" || !item.children || !expanded(item.key)) return;
      event.preventDefault();
      event.currentTarget.querySelector<HTMLAnchorElement>("a")?.focus();
      dismiss(item.key);
    },
  });

  /** A top-level link: the first touch tap opens its dropdown; anything else navigates. */
  const onParentClick = (item: NavItem) => (event: ReactMouseEvent<HTMLAnchorElement>) => {
    const intercept = shouldInterceptTap({
      hasChildren: Boolean(item.children),
      pointerType: pointerKind.current,
      openedByTap: touchOpen === item.key,
    });
    pointerKind.current = "";
    if (intercept) {
      event.preventDefault();
      setDismissed(null);
      setTouchOpen(item.key);
      return;
    }
    // Navigating: the dropdown has done its job. The header stays mounted across client
    // navigation, so a dropdown held open by focus would otherwise hang over the next page.
    if (item.children) dismiss(item.key);
  };

  // --- the burger overlay -----------------------------------------------------------------

  /**
   * The menu's CTA: close the menu first, then open the request dialog. Leaving the overlay
   * up would stack a full-screen menu behind the dialog and give the visitor two things to
   * dismiss.
   */
  const openFromMenu = () => {
    close();
    openRequest({ source: "navbar-menu", returnFocusTo: burgerRef.current });
  };

  /** The visible "×": close, and give focus back to the control that opened the menu. */
  const closeAndReturn = () => {
    close();
    burgerRef.current?.focus({ preventScroll: true });
  };

  /* While the overlay is up: the page underneath does not scroll, focus starts on the "×",
     Escape closes, and growing into the desktop layout closes it. `lockRootScroll` locks
     <html>, not <body> (Modal owns the body lock) and keeps the sticky header anchored. */
  useEffect(() => {
    if (!menuOpen) return;
    const unlock = lockRootScroll();
    closeRef.current?.focus({ preventScroll: true });

    /* `defaultPrevented`: the compact language popup in the header handles its own Escape
       (preventDefault + React stopPropagation). React's stopPropagation cannot stop a native
       listener on `document`, so the flag is the only way to know the key was used. */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      setMenuOpen(false);
      burgerRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", onKeyDown);

    const desktop =
      typeof window.matchMedia === "function" ? window.matchMedia(DESKTOP_QUERY) : null;
    const onViewport = () => {
      if (desktop?.matches) setMenuOpen(false);
    };
    desktop?.addEventListener?.("change", onViewport);

    return () => {
      unlock();
      document.removeEventListener("keydown", onKeyDown);
      desktop?.removeEventListener?.("change", onViewport);
    };
  }, [menuOpen]);

  /* Focus leaving both the overlay and the bar above it closes the menu — Tab past its last
     link, or Shift+Tab out of the header. That replaces a hard focus trap: the header stays
     usable (preferences, burger) while the menu is up. `relatedTarget` is null when the
     browser cannot say where focus went (window blur, a tap on iOS, the focused link
     unmounting); that is not "the visitor left", so the menu stays. */
  const onMenuFocusOut = (event: ReactFocusEvent<HTMLElement>) => {
    const next = event.relatedTarget as Node | null;
    if (!next) return;
    if (overlayRef.current?.contains(next) || headerRef.current?.contains(next)) return;
    setMenuOpen(false);
  };

  return (
    <>
      <header
        ref={headerRef}
        data-intro-reveal="header"
        onBlur={menuOpen ? onMenuFocusOut : undefined}
        data-condensed={condensed ? "" : undefined}
        /* The BOX, and nothing else: position, stacking order, and the 1px bottom rule that
           is part of --header-h. The rule is the full-width bar's own bottom edge, so it
           fades out with the bar — the island below draws its own ring. Its height is never
           touched, by this transition or any other. */
        className={`sticky top-0 z-(--z-header) border-b transition-[border-color] duration-300 ease-out motion-reduce:transition-none ${
          condensed ? "border-transparent" : "border-glass-line"
        }`}
      >
        {/* The PAINT: the only thing that condenses. Absolutely positioned, so its insets,
            its radius and its shadow animate without re-laying out anything — the header's
            reserved height stays exactly what --header-h says it is.

            It carries the TEXT-BEARING glass (`glass-text`): nav links and the clock sit on
            it over whatever scrolls by, the 3D canvas and photos included, and condensing
            changes neither the tint nor the blur, so the contrast behind the copy is the
            same in both states. Below 861px the blur is dropped for a near-opaque sheet —
            the hero behind it animates, and re-sampling a blur every frame costs phones FPS.

            The physical inset properties (top/right/bottom/left) rather than `inset-x` /
            `inset-y`: those emit the LOGICAL `inset-inline` / `inset-block`, which
            `transition-property: left` would not name. */}
        <div
          aria-hidden="true"
          data-header-bar=""
          className={`pointer-events-none absolute -z-10 glass-text max-md:bg-glass-solid max-md:backdrop-filter-none transition-[top,right,bottom,left,border-radius,box-shadow] duration-300 ease-out motion-reduce:transition-none after:pointer-events-none after:absolute after:h-px after:bg-linear-to-r after:from-transparent after:via-red after:to-transparent after:shadow-[0_0_14px_var(--glow-red)] after:transition-[left,right,bottom,opacity] after:duration-300 after:ease-out motion-reduce:after:transition-none ${
            condensed
              ? "top-[7px] right-[clamp(8px,2vw,24px)] bottom-[7px] left-[clamp(8px,2vw,24px)] rounded-lg [box-shadow:0_0_0_1px_var(--line),var(--sh-md)] after:right-[22%] after:bottom-0 after:left-[22%] after:opacity-80"
              : "top-0 right-0 bottom-0 left-0 rounded-none [box-shadow:0_0_0_1px_transparent,0_0_0_transparent] after:right-0 after:-bottom-px after:left-0 after:opacity-100"
          }`}
        />

        <div className="mx-auto flex max-w-(--maxw) items-center justify-between gap-[18px] px-(--gutter) py-[13px] max-[381px]:gap-2">
          <div className="flex min-w-0 items-center gap-4">
            {/* The wordmark. A 44px box at every width (the tap target on phones, and the
                row's height on desktop), glyphs centred in it. */}
            <a
              href="#top"
              className={`inline-flex min-h-11 shrink-0 items-center font-disp text-xl leading-none font-extrabold tracking-[-0.04em] text-txt uppercase no-underline max-[381px]:text-lg ${FOCUS_RING_CLASSES}`}
            >
              TBS
              {/* The red full stop: a glyph, no glow and no halo. */}
              <span className="text-red">.</span>
            </a>
            <HeaderClock variant="bar" />
          </div>

          {/* Desktop menu. Every top item keeps its own href and its label as its own text
              node; the "+" is a separate aria-hidden span, so the link's name is exactly the
              label. Dropdown children are always in the DOM (hidden with visibility, so they
              leave the Tab order until their item is open) — no new tab stops. */}
          <nav
            aria-label={t("nav.primaryAria")}
            className="hidden items-center gap-7 font-hud text-sm tracking-[.08em] md:flex"
          >
            {navMenu.map((item) => (
              <div
                key={item.href}
                data-menu-item={item.key}
                data-open={touchOpen === item.key ? "" : undefined}
                data-dismissed={dismissed === item.key ? "" : undefined}
                className="relative inline-flex items-center"
                {...itemHandlers(item)}
              >
                <a
                  href={item.href}
                  aria-haspopup={item.children ? "true" : undefined}
                  aria-expanded={item.children ? expanded(item.key) : undefined}
                  onPointerDown={(event) => {
                    pointerKind.current = event.pointerType;
                  }}
                  onClick={onParentClick(item)}
                  className={`relative inline-flex min-h-11 items-center whitespace-nowrap text-mut no-underline transition-colors duration-150 hover:text-txt menu-open:text-txt motion-reduce:transition-none ${FOCUS_RING_CLASSES} after:pointer-events-none after:absolute after:inset-x-0 after:bottom-2.5 after:h-px after:origin-left after:scale-x-0 after:bg-red after:shadow-[0_0_8px_var(--glow-red)] after:transition-transform after:duration-200 hover:after:scale-x-100 menu-open:after:scale-x-100 motion-reduce:after:transition-none`}
                >
                  {t(item.key)}
                  {item.children && (
                    <span
                      aria-hidden="true"
                      className="ml-1.5 inline-block font-bold text-red-text transition-transform duration-200 menu-open:rotate-45 motion-reduce:transition-none"
                    >
                      +
                    </span>
                  )}
                </a>

                {/* The glass panel, text-bearing glass like the bar: it opens over the hero
                    headline. Opening drops `visibility` from the transition, so the children
                    are focusable in the very frame focus lands on the top link (a fast Tab
                    would otherwise skip past them); closing keeps it, so the fade out runs. */}
                {item.children && (
                  <div className="glass-text pointer-events-none invisible absolute top-[calc(100%+var(--sp-3))] left-0 z-(--z-dropdown) flex min-w-58 -translate-y-1.5 flex-col rounded-md border border-glass-line p-2 opacity-0 shadow-lg transition-[opacity,translate,visibility] duration-150 menu-open:transition-[opacity,translate] before:absolute before:inset-x-0 before:-top-3 before:h-3 after:pointer-events-none after:absolute after:inset-x-3 after:top-0 after:h-px after:bg-linear-to-r after:from-transparent after:via-red after:to-transparent menu-open:pointer-events-auto menu-open:visible menu-open:translate-y-0 menu-open:opacity-100 motion-reduce:transition-none">
                    {item.children.map((child) => (
                      <NavChildLink
                        key={child.href}
                        href={child.href}
                        onClick={() => dismiss(item.key)}
                        className="flex min-h-11 items-center rounded-sm border-l-2 border-transparent px-3 tracking-[.03em] whitespace-nowrap text-mut no-underline transition-[color,background-color,border-color,translate] duration-150 hover:translate-x-0.5 hover:border-red hover:bg-panel2 hover:text-txt focus-visible:border-red focus-visible:bg-panel2 focus-visible:text-txt focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan motion-reduce:transition-none motion-reduce:hover:translate-x-0"
                      >
                        {t(child.key)}
                      </NavChildLink>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* The right-hand end of the bar, on EVERY screen size: global preferences
              (the language switcher), then the red CTA, then the burger. Only the CTA and
              the burger swap in and out at 860px — the preferences group never does, which
              is what keeps the language switcher visible on a phone instead of buried in
              the hamburger menu. Keeping the CTA as the group's next sibling also preserves
              the "preferences, then call to action" reading order everywhere. */}
          <div className="flex items-center gap-5 max-md:gap-3 max-[381px]:gap-2">
            <PreferencesGroup />
            {/* Opens the shared request dialog — a real button, never an anchor. Its text is
                exactly `nav.cta` (a test compares textContent), so the neon is box-shadow
                only: no icon or wrapper inside. 43.4px, not the 56.8px of content CTAs: it
                lives in the bar, and it is hidden below 861px where the overlay carries it. */}
            <button
              type="button"
              className="cta-neon hidden min-h-[43.4px] items-center rounded-md px-5 py-3 font-hud text-sm leading-[1.55] font-bold tracking-[.06em] whitespace-nowrap md:inline-flex"
              onClick={() => openRequest({ source: "navbar" })}
            >
              {t("nav.cta")}
            </button>

            {/* The label stays `nav.burgerAria` while open (tests find the burger by it, and
                the overlay's own "×" is the one named `nav.closeAria`). Open, it wears the red
                neon, and its focus ring turns --txt, exactly like `cta-neon`'s. */}
            <button
              type="button"
              ref={burgerRef}
              aria-label={t("nav.burgerAria")}
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? menuId : undefined}
              onClick={() => setMenuOpen((v) => !v)}
              className={`group/burger inline-flex min-h-11 min-w-11 cursor-pointer flex-col items-center justify-center gap-[5px] border border-glass-line bg-glass px-3 py-[11px] transition-[border-color,box-shadow] duration-150 hover:border-blue hover:shadow-neon-blue aria-expanded:border-red aria-expanded:shadow-neon-red aria-expanded:focus-visible:outline-txt md:hidden motion-reduce:transition-none ${FOCUS_RING_CLASSES}`}
            >
              <span className="block h-0.5 w-5 bg-txt transition-colors group-aria-expanded/burger:bg-red motion-reduce:transition-none" />
              <span className="block h-0.5 w-5 bg-txt transition-colors group-aria-expanded/burger:bg-red motion-reduce:transition-none" />
              <span className="block h-0.5 w-5 bg-txt transition-colors group-aria-expanded/burger:bg-red motion-reduce:transition-none" />
            </button>
          </div>
        </div>
      </header>

      {/* The burger overlay. Rendered only while open (tests count its controls), and UNDER
          the header (z 115 < 120): the bar — burger, preferences — stays on top and usable,
          so the overlay starts below it.
          Solid glass with no blur: a full-screen backdrop-filter over the hero's animations
          would re-sample every frame on a phone. The page colour goes underneath the 94%
          sheet, because the 6% of page that glass lets through reads as ghosted headlines
          when nothing blurs it. The HUD grid and a red glow sit on the sheet. */}
      {menuOpen && (
        <div
          ref={overlayRef}
          onBlur={onMenuFocusOut}
          className="fixed inset-0 z-(--z-nav-overlay) overflow-x-hidden overflow-y-auto overscroll-contain bg-bg animate-menu-in md:hidden"
        >
          <nav
            id={menuId}
            aria-label={t("nav.burgerAria")}
            className="relative isolate flex min-h-full flex-col gap-1.5 bg-glass-solid cyber-grid px-(--gutter) pt-[calc(var(--header-h)+var(--sp-4))] pb-10 before:pointer-events-none before:absolute before:-top-48 before:-right-48 before:-z-10 before:size-120 before:rounded-full before:bg-[radial-gradient(closest-side,var(--glow-red),transparent)] before:opacity-45"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <HeaderClock variant="menu" />
              <button
                ref={closeRef}
                type="button"
                aria-label={t("nav.closeAria")}
                onClick={closeAndReturn}
                className={`ml-auto inline-flex size-11 shrink-0 cursor-pointer items-center justify-center border border-glass-line bg-glass font-hud text-lg leading-none text-txt transition-[border-color,color,box-shadow] duration-150 hover:border-red hover:text-red-text hover:shadow-neon-red motion-reduce:transition-none ${FOCUS_RING_CLASSES}`}
              >
                ×
              </button>
            </div>

            {navMenu.map((item, i) => (
              <div key={item.href} className="flex flex-col">
                <a
                  href={item.href}
                  onClick={close}
                  className={`flex min-h-11 items-baseline gap-3 border-b border-glass-line py-3 font-disp text-[clamp(26px,8vw,34px)] leading-[1.1] font-black tracking-[-0.02em] text-txt uppercase no-underline transition-colors hover:text-red-text motion-reduce:transition-none ${FOCUS_RING_CLASSES}`}
                >
                  <span
                    aria-hidden="true"
                    className="font-hud text-xs font-bold tracking-[.1em] text-red-text"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {cap(t(item.key))}
                </a>
                {item.children && (
                  <div className="flex flex-col gap-0.5 pt-0.5 pb-2.5">
                    {item.children.map((child) => (
                      <NavChildLink
                        key={child.href}
                        href={child.href}
                        onClick={close}
                        className="flex min-h-11 items-center border-l-2 border-line py-2 pl-4 font-hud text-[15px] tracking-[.03em] text-mut no-underline transition-colors hover:border-red hover:text-red-text focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan motion-reduce:transition-none"
                      >
                        {t(child.key)}
                      </NavChildLink>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* No preferences group here on purpose: the language switcher lives in the bar
                above, which stays visible over the menu — repeating it would put the same
                control on screen twice. The menu is navigation only. */}
            <button
              type="button"
              onClick={openFromMenu}
              className="cta-neon mt-3.5 flex min-h-[56.8px] items-center justify-center rounded-md p-4 font-hud text-base leading-[1.55] font-bold tracking-[.06em] sm:self-start sm:px-12"
            >
              {t("nav.cta")}
            </button>
          </nav>
        </div>
      )}
    </>
  );
}
