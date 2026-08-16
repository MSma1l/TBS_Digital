"use client";

import { Estimator } from "./Estimator";
import { DictationButton } from "@/components/ui/DictationButton";

/**
 * The request section, with dictation wired into it.
 *
 * `Estimator` takes its microphone as a render prop so the two stay decoupled — the
 * estimator owns the fields, the button owns the permission dance, and neither reaches
 * into the other's state. Render props are functions, though, and a function cannot cross
 * the server/client boundary, so `app/(site)/page.tsx` (a server component) cannot pass
 * them directly. This client wrapper is that boundary.
 *
 * `DictationButton` renders nothing at all when the browser has no speech recognition, so
 * on those browsers the slots simply stay empty — `.dictationSlot:empty` collapses them and
 * the layout is unchanged. No button that does nothing.
 */
export function RequestSection({ serviceSlug }: { serviceSlug?: string } = {}) {
  return (
    <Estimator
      serviceSlug={serviceSlug}
      renderChatDictation={({ onTranscript }) => (
        <DictationButton onResult={onTranscript} />
      )}
      renderDetailsDictation={({ onTranscript }) => (
        <DictationButton onResult={onTranscript} />
      )}
    />
  );
}
