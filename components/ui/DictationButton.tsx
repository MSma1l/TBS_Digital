"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import { useSound } from "@/lib/sound";
import type { Locale } from "@/lib/i18n/locales";
import styles from "./DictationButton.module.css";

/**
 * Dictation — speak instead of typing, into a field the visitor still owns.
 *
 * The rules this component is built around, in the order they constrain the code:
 *
 *  · **It starts only on a click.** Nothing is constructed on mount; the recogniser is
 *    created inside the click handler and nowhere else.
 *  · **Permission is asked for explicitly**, through `getUserMedia`, and the stream is
 *    stopped in the same breath — the component never reads samples from it. If permission
 *    is refused, the visitor gets a plain sentence and the field they were always going to
 *    be able to type into. A refusal is a state, not a breakage.
 *  · **No audio is stored or sent. Ever.** There is no recorder, no blob, no upload; the
 *    only thing that leaves this component is text, and only after the visitor presses
 *    "add". The recognised text lands in an editable box first, so they can fix it.
 *  · **When the API isn't there, neither is the button.** A control that cannot do its one
 *    job is worse than no control, so `SpeechRecognition` absence renders `null`.
 */

/* --- the Web Speech API, typed just enough ------------------------------------------------
   `SpeechRecognition` is not in every browser and its typings differ between TS DOM
   versions, so the shapes actually used are declared locally and the constructor is read
   through a cast. This keeps the component compiling everywhere without `any`. */

type SpeechAlternativeLike = { transcript: string };
type SpeechResultLike = ArrayLike<SpeechAlternativeLike> & { isFinal: boolean };
type SpeechResultEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechResultLike>;
};
type SpeechErrorEventLike = { error?: string };

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechResultEventLike) => void) | null;
  onerror: ((event: SpeechErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

/** The constructor, or `null` in a browser (or a server) that has no speech recognition. */
export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/* Whether the browser can listen is a value the server cannot know and that never changes
   afterwards, so it is read as an external store: `getServerSnapshot` returns `false`, the
   hydration render matches the server's markup exactly, and React swaps in the real answer
   immediately after. (The same primitive the theme uses for `prefers-color-scheme`.) */
const subscribeSupport = () => () => {};
const getSupportSnapshot = () => getSpeechRecognitionCtor() !== null;
const getServerSupportSnapshot = () => false;

/** BCP-47 tags for the three site languages — what the recogniser listens for. */
const RECOGNITION_LANG: Record<Locale, string> = {
  ro: "ro-RO",
  ru: "ru-RU",
  en: "en-US",
};

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

const COPY = {
  start: L("Dictează", "Диктовать", "Dictate"),
  startAria: L(
    "Dictează textul cu vocea",
    "Продиктовать текст голосом",
    "Dictate the text with your voice",
  ),
  stop: L("Oprește", "Остановить", "Stop"),
  stopAria: L("Oprește dictarea", "Остановить диктовку", "Stop dictation"),
  listening: L("Ascult…", "Слушаю…", "Listening…"),
  requesting: L(
    "Se cere permisiunea pentru microfon…",
    "Запрашивается доступ к микрофону…",
    "Asking for microphone permission…",
  ),
  draftLabel: L(
    "Textul recunoscut — verifică-l înainte de a-l adăuga",
    "Распознанный текст — проверьте перед добавлением",
    "Recognised text — check it before adding",
  ),
  add: L("Adaugă în câmp", "Добавить в поле", "Add to the field"),
  discard: L("Renunță", "Отменить", "Discard"),
  privacy: L(
    "Nu înregistrăm și nu trimitem sunet — doar textul pe care îl confirmi tu.",
    "Мы не записываем и не отправляем звук — только текст, который вы подтвердите.",
    "We don't record or send audio — only the text you confirm.",
  ),
  denied: L(
    "Accesul la microfon a fost refuzat. Poți scrie textul manual în câmpul de mai jos — nimic nu se pierde.",
    "Доступ к микрофону запрещён. Вы можете написать текст вручную в поле ниже — ничего не потеряется.",
    "Microphone access was denied. You can type the text manually in the field below — nothing is lost.",
  ),
  failed: L(
    "Dictarea nu a pornit. Încearcă din nou sau scrie textul manual.",
    "Диктовка не запустилась. Попробуйте снова или напишите текст вручную.",
    "Dictation didn't start. Try again, or type the text manually.",
  ),
  noSpeech: L(
    "Nu am auzit nimic. Apasă din nou și vorbește după ton.",
    "Ничего не слышно. Нажмите снова и говорите после сигнала.",
    "I didn't hear anything. Press again and speak after the tone.",
  ),
  dismiss: L("Închide mesajul", "Закрыть сообщение", "Dismiss message"),
};

/**
 * `idle` → `requesting` (permission) → `listening` → `review` (confirm the text) → `idle`.
 * `denied` and `error` are dead ends the visitor dismisses or retries out of; both leave
 * manual typing untouched.
 */
type Status = "idle" | "requesting" | "listening" | "review" | "denied" | "error";

/** A refusal, however the browser chose to word it. */
function isPermissionDenial(error: unknown): boolean {
  if (typeof error === "string") return error === "not-allowed" || error === "service-not-allowed";
  const name = (error as { name?: string } | null)?.name;
  return name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError";
}

export function DictationButton({
  onResult,
  disabled = false,
  className = "",
}: {
  /** Called with the text the visitor **confirmed**. Never called automatically. */
  onResult: (text: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const l = useLoc();
  const { locale } = useLanguage();
  const { play } = useSound();
  // Unique per instance: the draft box is a labelled field, and two dictation buttons on
  // one page must not share an id.
  const draftId = useId();

  // Support is resolved through the store above, never as plain render work: the server has
  // no `SpeechRecognition`, so deciding in render would hydrate one tree and paint another.
  const supported = useSyncExternalStore(
    subscribeSupport,
    getSupportSnapshot,
    getServerSupportSnapshot,
  );
  const [status, setStatus] = useState<Status>("idle");
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<LocalizedText | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTextRef = useRef("");

  /** Drop the recogniser — on unmount, on stop, on every failure path. */
  const teardown = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try {
      recognition.abort();
    } catch {
      /* already stopped */
    }
  }, []);

  useEffect(() => teardown, [teardown]);

  /**
   * Ask for the microphone, out loud.
   *
   * The stream is stopped on the very next line: this call exists to produce the browser's
   * permission prompt and a clean allowed/denied answer, not to capture anything. The
   * recogniser opens its own stream afterwards. Returns `false` if we must not continue.
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    const media = (
      navigator as Navigator & {
        mediaDevices?: { getUserMedia?: (c: MediaStreamConstraints) => Promise<MediaStream> };
      }
    ).mediaDevices;
    if (!media?.getUserMedia) return true; // no gate available — let recognition ask itself

    try {
      const stream = await media.getUserMedia({ audio: true });
      stream.getTracks?.().forEach((track) => track.stop());
      return true;
    } catch (error) {
      setStatus(isPermissionDenial(error) ? "denied" : "error");
      setNotice(isPermissionDenial(error) ? COPY.denied : COPY.failed);
      return false;
    }
  }, []);

  const start = useCallback(async () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || disabled) return;

    setNotice(null);
    setDraft("");
    finalTextRef.current = "";
    setStatus("requesting");
    play("tap");

    if (!(await requestPermission())) return;

    const recognition = new Ctor();
    recognition.lang = RECOGNITION_LANG[locale];
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex ?? 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result?.[0]?.transcript ?? "";
        if (result?.isFinal) finalTextRef.current = `${finalTextRef.current} ${text}`.trim();
        else interim += text;
      }
      setDraft(`${finalTextRef.current} ${interim}`.trim());
    };

    recognition.onerror = (event) => {
      const code = event?.error;
      teardown();
      if (isPermissionDenial(code)) {
        setStatus("denied");
        setNotice(COPY.denied);
        return;
      }
      setStatus(finalTextRef.current ? "review" : "error");
      setNotice(code === "no-speech" ? COPY.noSpeech : COPY.failed);
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      // Recognition ending is not a result: the text goes to review, where the visitor
      // decides. Nothing is inserted, and certainly nothing is sent, on its own.
      setStatus((current) =>
        current === "listening" ? (finalTextRef.current ? "review" : "idle") : current,
      );
    };

    try {
      recognition.start();
    } catch {
      teardown();
      setStatus("error");
      setNotice(COPY.failed);
      return;
    }

    recognitionRef.current = recognition;
    setStatus("listening");
  }, [disabled, locale, play, requestPermission, teardown]);

  /** The visitor's way out of "listening", always one click away. */
  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    try {
      recognition?.stop();
    } catch {
      /* already stopping */
    }
    setStatus(finalTextRef.current ? "review" : "idle");
  }, []);

  const confirm = useCallback(() => {
    const text = draft.trim();
    setStatus("idle");
    setDraft("");
    finalTextRef.current = "";
    if (!text) return;
    play("confirm");
    onResult(text);
  }, [draft, onResult, play]);

  const discard = useCallback(() => {
    setStatus("idle");
    setDraft("");
    finalTextRef.current = "";
    setNotice(null);
  }, []);

  // The API is missing → the button is missing. No dead control, no tooltip apology.
  if (!supported) return null;

  const listening = status === "listening" || status === "requesting";

  return (
    <div className={`${styles.wrap} ${className}`}>
      <button
        type="button"
        className={`${styles.button} ${listening ? styles.listening : ""}`}
        onClick={listening ? stop : start}
        disabled={disabled}
        aria-pressed={listening}
        aria-label={l(listening ? COPY.stopAria : COPY.startAria)}
      >
        <span className={styles.iconBox} aria-hidden="true">
          {listening ? <StopIcon /> : <MicIcon />}
          {status === "listening" && <span className={styles.pulse} />}
        </span>
        <span className={styles.label}>{l(listening ? COPY.stop : COPY.start)}</span>
      </button>

      {/* One live region for every state change, so a screen-reader user hears the same
          thing a sighted one sees: listening, refused, failed. */}
      <p className={styles.status} role="status" aria-live="polite">
        {status === "requesting" && l(COPY.requesting)}
        {status === "listening" && l(COPY.listening)}
        {notice && status !== "listening" && status !== "requesting" && l(notice)}
      </p>

      {(status === "denied" || status === "error") && (
        <button type="button" className={styles.dismiss} onClick={discard}>
          {l(COPY.dismiss)}
        </button>
      )}

      {status === "review" && (
        <div className={styles.review}>
          <label className={styles.reviewLabel} htmlFor={draftId}>
            {l(COPY.draftLabel)}
          </label>
          {/* Editable on purpose: recognition is approximate, and the visitor corrects it
              here before anything is handed to the form. */}
          <textarea
            id={draftId}
            className={styles.draft}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
          />
          <p className={styles.privacy}>{l(COPY.privacy)}</p>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={confirm}>
              {l(COPY.add)}
            </button>
            <button type="button" className={styles.secondary} onClick={discard}>
              {l(COPY.discard)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MicIcon() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="7" y="7" width="10" height="10" rx="2" />
    </svg>
  );
}
