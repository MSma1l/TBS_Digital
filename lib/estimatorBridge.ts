"use client";

/**
 * Bridge from a service card (/03) to the estimator (/07): clicking a service scrolls to
 * the estimator and pre-selects that service, so the visitor lands with the form ready to
 * fill in. The two sections are separate components, so they talk over a window event
 * rather than shared React state.
 */
export const ESTIMATE_EVENT = "tbs:estimate";

/** Ask the estimator to select `serviceId`, then scroll it into view. */
export function requestEstimate(serviceId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<string>(ESTIMATE_EVENT, { detail: serviceId }),
  );
  document
    .getElementById("contact")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}
