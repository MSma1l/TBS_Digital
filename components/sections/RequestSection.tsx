"use client";

import dynamic from "next/dynamic";
import { Estimator, type EstimatorProps } from "./Estimator";
import type { RequestContext } from "@/lib/request/RequestFlowProvider";

/**
 * The microphone is loaded after the page is interactive, not with it.
 *
 * `DictationButton` decides whether it exists at all from `window.SpeechRecognition`, which
 * the server cannot know: its server snapshot is `false`, so it already renders NOTHING in
 * the SSR markup and only appears once the client has hydrated. `ssr: false` therefore
 * reproduces today's server output exactly, while moving ~10 KB of speech-recognition code,
 * its copy in three languages and its stylesheet out of the page's critical chunk into one
 * fetched alongside hydration. The slot it lands in is `.dictationSlot:empty`-collapsed
 * until then — the same state it is in before hydration today.
 */
const DictationButton = dynamic(
  () => import("@/components/ui/DictationButton").then((m) => m.DictationButton),
  { ssr: false },
);

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
 *
 * `context` is where the request was started from (`lib/request/RequestFlowProvider.tsx`).
 * The home page renders this section with none — it is the section, not a dialog opened
 * from somewhere; the shared dialog passes the CTA's context straight through.
 *
 * `layout` picks the arrangement: the home page takes the default `"section"`, the shared
 * dialog asks for `"dialog"` — one column, three steps, the assistant on request.
 */
export function RequestSection({
  context,
  layout,
}: { context?: RequestContext; layout?: EstimatorProps["layout"] } = {}) {
  return (
    <Estimator
      context={context}
      layout={layout}
      renderChatDictation={({ onTranscript }) => (
        <DictationButton onResult={onTranscript} />
      )}
      renderDetailsDictation={({ onTranscript }) => (
        <DictationButton onResult={onTranscript} />
      )}
    />
  );
}
