"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { RequestSection } from "./RequestSection";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

const COPY = {
  title: L("Spune-ne ce vrei să construiești.", "Расскажите, что хотите построить.", "Tell us what you want to build."),
  lead: L(
    "Un dialog scurt clarifică cererea, iar rezumatul se atașează automat propunerii.",
    "Короткий диалог уточняет запрос, а его résumé автоматически прикрепляется к предложению.",
    "A short dialog clarifies the request, and its summary is attached to the proposal automatically.",
  ),
};

/**
 * The request flow, opened in place.
 *
 * On a service page the estimator is not on the page at all, so the CTA used to navigate to
 * `/?serviciu=<slug>#estimare` — leaving the page the visitor was reading. Opening the same
 * flow in a dialog keeps them where they are, and lets the service be preselected directly
 * rather than through the address bar.
 *
 * The flow inside is the real one: the same component the homepage renders, posting to the
 * same endpoint. Nothing about the request is duplicated or simulated for the modal.
 */
export function RequestModal({
  serviceSlug,
  label,
  className,
}: {
  serviceSlug?: string;
  /** Already-localized button text — the caller owns its own copy. */
  label: string;
  className?: string;
}) {
  const l = useLoc();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={l(COPY.title)}
        description={l(COPY.lead)}
      >
        {/* Mounted only while open, so every opening starts a clean dialog rather than
            resuming a half-finished one from a previous visit to the modal. */}
        <RequestSection serviceSlug={serviceSlug} />
      </Modal>
    </>
  );
}
