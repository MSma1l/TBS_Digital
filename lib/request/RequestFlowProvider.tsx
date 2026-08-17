"use client";

import dynamic from "next/dynamic";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Modal } from "@/components/ui/Modal";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import { useSound } from "@/lib/sound";

/**
 * The request flow is loaded on demand, not with the page.
 *
 * `Modal` renders `null` until it is open, so this subtree is never mounted before a visitor
 * presses a CTA — yet a static import would still put the whole estimator (its dialog tree,
 * validation, contact form and the dictation button) into the first load of EVERY page, now
 * that the flow is mounted in the root layout. `next/dynamic` turns that into a chunk
 * fetched at press time.
 *
 * `ssr: false` is not a downgrade: `Modal` already renders nothing on the server (it needs a
 * real `document` for its portal), so the server markup is byte-for-byte what it was.
 */
const RequestSection = dynamic(
  () => import("@/components/sections/RequestSection").then((m) => m.RequestSection),
  { ssr: false },
);

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

/* The dialog's own copy — the same two lines the flow has always carried. Local
   `{ro,ru,en}` objects rather than catalog keys, same as `components/sections/Estimator.tsx`. */
const COPY = {
  title: L(
    "Spune-ne ce vrei să construiești.",
    "Расскажите, что хотите построить.",
    "Tell us what you want to build.",
  ),
  lead: L(
    "Un dialog scurt clarifică cererea, iar rezumatul se atașează automat propunerii.",
    "Короткий диалог уточняет запрос, а его résumé автоматически прикрепляется к предложению.",
    "A short dialog clarifies the request, and its summary is attached to the proposal automatically.",
  ),
};

/**
 * Which CTA opened the flow.
 *
 * A closed set rather than a free string: these ids travel to the team inside the request,
 * so a typo would quietly produce an unroutable lead. Add a member here when a new CTA is
 * wired up — the compiler then points at every place that has to name it.
 */
export type RequestSource =
  | "hero"
  | "navbar"
  | "navbar-menu"
  | "bottom-cta"
  | "service-page"
  | "service-page-bottom"
  | "project-card";

/**
 * What the visitor was looking at when they pressed the CTA.
 *
 * `serviceSlug` preselects the estimator's project type (`SERVICE_TO_ESTIMATOR_TYPE`);
 * the project fields and `source` are carried into the sent message, so the team can see
 * where a lead came from instead of guessing.
 */
export type RequestContext = {
  /** A direction slug (`produs-digital`, `e-commerce`, …). Preselects the project type. */
  serviceSlug?: string;
  /** Portfolio id of the project the CTA sat on, when it sat on one. */
  projectId?: string;
  /** That project's name, for a reader who doesn't know the ids. */
  projectName?: string;
  /** Short id of the CTA itself. */
  source?: RequestSource;
};

export type RequestOptions = RequestContext & {
  /**
   * Where focus goes when the dialog closes. Defaults to whatever had focus at the moment
   * `openRequest` was called — pass this only when that element is about to disappear (the
   * mobile menu closes itself on the way here, taking its own CTA with it).
   */
  returnFocusTo?: HTMLElement | null;
};

export type RequestFlowApi = {
  /** Is the request dialog on screen? */
  isOpen: boolean;
  /** The context the open dialog was given. `{}` while it is closed. */
  context: RequestContext;
  /** Open the request dialog, carrying the context it was opened from. */
  openRequest: (options?: RequestOptions) => void;
  /** Close it. Same thing the ✕, Escape and the backdrop do. */
  closeRequest: () => void;
};

const RequestFlowContext = createContext<RequestFlowApi | null>(null);

/**
 * One request flow for the whole site.
 *
 * Every commercial CTA — the hero, the navbar (bar and menu), the bottom CTA, both actions
 * on a service page — calls `openRequest()` from `useRequestFlow()`. The dialog itself is
 * mounted **here, once**, in `app/layout.tsx`: a CTA that rendered its own `Modal` would put
 * one dialog in the DOM per CTA, so a page with four of them would ship four dialogs, four
 * focus traps and four scroll locks.
 *
 * The flow inside is the real one — the same `RequestSection` the home page renders as a
 * visible section, posting to the same endpoint. Nothing is duplicated or simulated for the
 * dialog, and the estimator section on the home page is untouched by any of this.
 */
export function RequestFlowProvider({ children }: { children: ReactNode }) {
  const l = useLoc();
  const { play } = useSound();

  /* `null` is closed; an object (possibly empty) is open. One state, so "is it open" and
     "what was it opened with" can never disagree. */
  const [context, setContext] = useState<RequestContext | null>(null);

  /* The control the visitor pressed, so focus can go back to it. Captured in the handler
     rather than read by the dialog on mount: a shared dialog is often opened by something
     that is unmounting in the same commit (the mobile menu), and by the time the dialog's
     own effect runs `document.activeElement` would already be <body>. */
  const triggerRef = useRef<HTMLElement | null>(null);

  const openRequest = useCallback(
    (options: RequestOptions = {}) => {
      const { returnFocusTo, ...requestContext } = options;
      triggerRef.current =
        returnFocusTo ??
        (typeof document !== "undefined"
          ? (document.activeElement as HTMLElement | null)
          : null);

      /* Click feedback for every CTA, in one place instead of copied into each button.
         `play()` is a no-op while sound is off (the default) and before the visitor's
         first gesture, so this can never become autoplay — and a CTA press *is* a
         gesture, which is what makes this the legitimate case. */
      play("tap");

      setContext(requestContext);
    },
    [play],
  );

  const closeRequest = useCallback(() => setContext(null), []);

  const value = useMemo<RequestFlowApi>(
    () => ({
      isOpen: context !== null,
      context: context ?? {},
      openRequest,
      closeRequest,
    }),
    [context, openRequest, closeRequest],
  );

  return (
    <RequestFlowContext.Provider value={value}>
      {children}
      <Modal
        open={context !== null}
        onClose={closeRequest}
        title={l(COPY.title)}
        description={l(COPY.lead)}
        restoreFocusRef={triggerRef}
      >
        {/* Mounted only while open, so every opening starts a clean dialog rather than
            resuming a half-finished one from a previous visit to the modal.

            `layout="dialog"` is the stepped arrangement: one column, three steps
            (project → contents → details) and the assistant behind a button. The home
            page's `#estimare` keeps the section arrangement it was designed with. */}
        <RequestSection context={context ?? undefined} layout="dialog" />
      </Modal>
    </RequestFlowContext.Provider>
  );
}

/**
 * The one way to open the request flow.
 *
 * ```tsx
 * const { openRequest } = useRequestFlow();
 * <button type="button" onClick={() => openRequest({ source: "hero" })}>…</button>
 * ```
 *
 * Throws without a provider above it rather than silently doing nothing: a CTA that opens
 * no dialog is exactly the bug this hook exists to make impossible.
 */
export function useRequestFlow(): RequestFlowApi {
  const api = useContext(RequestFlowContext);
  if (!api) {
    throw new Error(
      "useRequestFlow() must be used under <RequestFlowProvider> (mounted in app/layout.tsx).",
    );
  }
  return api;
}
