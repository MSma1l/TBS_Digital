"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useLoc, type LocalizedText, type MaybeLocalized } from "@/lib/i18n/content";
import styles from "./Modal.module.css";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

/* The only copy the modal owns itself — everything else arrives as props. Local
   `{ro,ru,en}` objects rather than catalog keys, same as `components/sections/Estimator.tsx`. */
const COPY = {
  close: L("Închide", "Закрыть", "Close"),
};

/**
 * Everything the browser can put focus on. Deliberately attribute-based: a
 * visibility check via `offsetParent` / `getClientRects()` would be correct in a
 * browser but returns "invisible" for *every* node under jsdom, which would empty
 * the trap in tests and silently let focus escape there.
 */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "audio[controls]",
  "video[controls]",
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) =>
      !el.hasAttribute("hidden") &&
      el.getAttribute("aria-hidden") !== "true" &&
      el.closest("[inert]") === null,
  );
}

/* ---------------------------------------------------------------------------
   Background scroll lock

   Shared module state, not per-instance: two stacked modals must lock once and
   unlock once. Without the counter the inner modal's cleanup would "restore"
   the styles the *outer* lock had already applied and scroll the page to 0.
   --------------------------------------------------------------------------- */

type BodyStyleSnapshot = {
  overflow: string;
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  paddingRight: string;
};

let lockCount = 0;
let lockedSnapshot: BodyStyleSnapshot | null = null;
let lockedScrollY = 0;

function lockBodyScroll() {
  if (lockCount++ > 0) return;

  const body = document.body;
  lockedScrollY = window.scrollY;

  /* Width the scrollbar occupied. `position: fixed` collapses the body, so the
     document scrollbar disappears and the page would jump sideways by exactly
     this much — paying it back as padding keeps the layout still. */
  const scrollbarGap = window.innerWidth - document.documentElement.clientWidth;

  lockedSnapshot = {
    overflow: body.style.overflow,
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    paddingRight: body.style.paddingRight,
  };

  /* `overflow: hidden` alone is ignored by iOS Safari, which keeps rubber-banding
     the page under the sheet — pinning the body is what actually freezes it. */
  body.style.overflow = "hidden";
  body.style.position = "fixed";
  body.style.top = `-${lockedScrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  if (scrollbarGap > 0) body.style.paddingRight = `${scrollbarGap}px`;
}

function unlockBodyScroll() {
  if (lockCount === 0) return;
  if (--lockCount > 0) return;

  const snapshot = lockedSnapshot;
  lockedSnapshot = null;
  if (!snapshot) return;

  Object.assign(document.body.style, snapshot);
  // The body was pinned, so the viewport sat at 0 — put it back where it was.
  window.scrollTo(0, lockedScrollY);
}

export type ModalProps = {
  /** Whether the dialog is on screen. Nothing renders while it is `false`. */
  open: boolean;
  /** Asked to close — by the ✕, Escape, or a click on the backdrop. */
  onClose: () => void;
  /** Accessible name. Rendered as the heading and wired up via `aria-labelledby`. */
  title: MaybeLocalized;
  /** Optional supporting line under the title, wired up via `aria-describedby`. */
  description?: MaybeLocalized;
  /** Optional mono kicker above the title (the site's usual section eyebrow). */
  eyebrow?: MaybeLocalized;
  children: ReactNode;
  /** Pinned below the scrolling body — action row, fine print, etc. */
  footer?: ReactNode;
  /**
   * Element to focus when the dialog opens. Defaults to the first focusable node,
   * which for a form modal is usually the ✕ — point this at the first field instead.
   */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Set to `false` for a flow that must not be dismissed by a stray backdrop click. */
  closeOnOverlayClick?: boolean;
  /** Set to `false` to keep Escape from closing (rare — prefer leaving it on). */
  closeOnEscape?: boolean;
  /** Extra class on the panel, for a caller that needs a different width. */
  className?: string;
};

/**
 * The dialog every request-flow step is shown in.
 *
 * It is a real dialog, not a styled overlay: `role="dialog"` + `aria-modal`, a name
 * from its own heading, focus that moves in on open, cycles inside on Tab and returns
 * to whatever opened it on close, and a page behind it that cannot scroll or shift.
 * Desktop it is a centred panel; under 640px it becomes a sheet anchored to the bottom.
 *
 * Rendered through a portal on `document.body` so no ancestor's `overflow`,
 * `transform` or `z-index` can clip it or trap it below another layer.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  eyebrow,
  children,
  footer,
  initialFocusRef,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className,
}: ModalProps) {
  const l = useLoc();
  const panelRef = useRef<HTMLDivElement | null>(null);

  /* Did the gesture that produced this click *start* on the backdrop? A press that
     begins on a slider/text selection inside the panel and is released over the
     backdrop still fires `click` on their common ancestor — the overlay — and would
     otherwise throw the visitor's work away. */
  const pressStartedOnOverlay = useRef(false);

  const reactId = useId();
  const titleId = `modal-title-${reactId}`;
  const descriptionId = `modal-desc-${reactId}`;

  /* Portals need a real `document`, which the server render doesn't have. This is the
     SSR-safe "am I on the client" read: `false` while the tree is rendered on the
     server, `true` once hydrated — no state set from an effect, no hydration mismatch. */
  const isClient = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

  /* Escape + the Tab cycle. Bound to the document in the capture phase rather than to
     the panel, so it still works if focus has drifted out of the panel for any reason. */
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel) return;

      if (event.key === "Escape") {
        if (!closeOnEscape) return;
        event.preventDefault();
        // Don't let a page-level Escape handler (another overlay) also react.
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const items = focusableWithin(panel);
      if (items.length === 0) {
        // Nothing to land on — hold focus on the panel itself rather than let it out.
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (!active || !panel.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose, closeOnEscape]);

  /* Focus in on open, focus back on close — one effect, because the "pull focus back"
     guard has to be torn down *before* focus is handed to the trigger, or it would
     immediately yank it into a panel that is on its way out. */
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    // Still the opener: the portal has rendered, but focus hasn't been moved yet.
    const trigger = document.activeElement as HTMLElement | null;
    let restoring = false;

    // Backstop for the ways focus can leave without a Tab keydown we see: a click on
    // the backdrop, browser find-in-page, an assistive-tech gesture.
    const onFocusIn = (event: FocusEvent) => {
      if (restoring) return;
      const node = event.target;
      if (!(node instanceof Node) || panel.contains(node)) return;
      const items = focusableWithin(panel);
      (items[0] ?? panel).focus();
    };
    document.addEventListener("focusin", onFocusIn);

    const initial = initialFocusRef?.current ?? focusableWithin(panel)[0] ?? panel;
    initial.focus();

    return () => {
      restoring = true;
      document.removeEventListener("focusin", onFocusIn);
      // `isConnected`: the trigger may have been unmounted while the modal was open.
      if (trigger && trigger !== document.body && trigger.isConnected) {
        trigger.focus();
      }
    };
  }, [open, initialFocusRef]);

  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    return unlockBodyScroll;
  }, [open]);

  const onOverlayPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    pressStartedOnOverlay.current = event.target === event.currentTarget;
  }, []);

  const onOverlayClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const startedOnOverlay = pressStartedOnOverlay.current;
      pressStartedOnOverlay.current = false;
      if (!closeOnOverlayClick) return;
      // Both ends of the gesture must be the backdrop itself.
      if (event.target !== event.currentTarget || !startedOnOverlay) return;
      onClose();
    },
    [closeOnOverlayClick, onClose],
  );

  if (!open || !isClient) return null;

  const titleText = l(title);
  const descriptionText = description ? l(description) : "";
  const eyebrowText = eyebrow ? l(eyebrow) : "";

  return createPortal(
    <div
      className={styles.overlay}
      onPointerDown={onOverlayPointerDown}
      onClick={onOverlayClick}
      data-testid="modal-overlay"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionText ? descriptionId : undefined}
        tabIndex={-1}
        className={`${styles.panel}${className ? ` ${className}` : ""}`}
      >
        <header className={styles.head}>
          <div className={styles.heading}>
            {eyebrowText && <p className={`mono ${styles.eyebrow}`}>{eyebrowText}</p>}
            <h2 id={titleId} className={`disp ${styles.title}`}>
              {titleText}
            </h2>
            {descriptionText && (
              <p id={descriptionId} className={styles.description}>
                {descriptionText}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={l(COPY.close)}
            className={styles.close}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </header>

        <div className={styles.body}>{children}</div>

        {footer && <footer className={styles.foot}>{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/** `useSyncExternalStore` needs a subscribe function; this value never changes. */
function subscribeToNothing() {
  return () => {};
}
