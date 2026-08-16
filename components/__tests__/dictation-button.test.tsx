import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DictationButton } from "@/components/ui/DictationButton";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import type { Locale } from "@/lib/i18n/locales";
import { resetAudioForTests, resetSoundStateForTests } from "@/lib/sound";

/**
 * Dictation is the one control on the site that can open a microphone, so its tests are
 * mostly about restraint: it must not start on its own, it must not keep anything, it must
 * survive a refusal, and it must not exist at all in a browser that can't do the job.
 *
 * jsdom has neither `SpeechRecognition` nor `mediaDevices`, which is convenient — every
 * capability the component looks for has to be installed explicitly by a test, so "absent"
 * is the default and the fallback paths are the ones that run unless we say otherwise.
 */

const RO_START = "Dictează textul cu vocea";
const RO_STOP = "Oprește dictarea";

/** A stand-in for the browser's recogniser, driven by hand from the tests. */
class FakeRecognition {
  static instances: FakeRecognition[] = [];
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  starts = 0;
  stops = 0;
  aborts = 0;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error?: string }) => void) | null = null;
  onend: (() => void) | null = null;

  constructor() {
    FakeRecognition.instances.push(this);
  }
  start() {
    this.starts += 1;
  }
  stop() {
    this.stops += 1;
    this.onend?.();
  }
  abort() {
    this.aborts += 1;
  }

  /** Deliver a recognised phrase the way the Web Speech API does. */
  say(transcript: string, isFinal = true) {
    const result = Object.assign([{ transcript }], { isFinal });
    this.onresult?.({ resultIndex: 0, results: [result] });
  }

  fail(error: string) {
    this.onerror?.({ error });
  }

  static get last(): FakeRecognition {
    return FakeRecognition.instances[FakeRecognition.instances.length - 1];
  }
}

type WindowWithSpeech = {
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
};

function installSpeechRecognition(vendorPrefixed = false) {
  const w = window as unknown as WindowWithSpeech;
  if (vendorPrefixed) w.webkitSpeechRecognition = FakeRecognition;
  else w.SpeechRecognition = FakeRecognition;
}

function removeSpeechRecognition() {
  const w = window as unknown as WindowWithSpeech;
  delete w.SpeechRecognition;
  delete w.webkitSpeechRecognition;
}

/** Install a microphone that either grants or refuses permission. */
function installMicrophone(
  outcome: "granted" | "denied" | "broken",
  stopTrack: () => void = () => {},
) {
  const getUserMedia = vi.fn(async () => {
    if (outcome === "denied") {
      const error = new Error("Permission denied");
      error.name = "NotAllowedError";
      throw error;
    }
    if (outcome === "broken") throw new Error("no device");
    return { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
  });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  return getUserMedia;
}

function removeMicrophone() {
  if ("mediaDevices" in navigator) {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });
  }
}

function renderButton({
  locale = "ro" as Locale,
  onResult = vi.fn(),
  disabled = false,
} = {}) {
  const view = render(
    <LanguageProvider initialLocale={locale}>
      <DictationButton onResult={onResult} disabled={disabled} />
    </LanguageProvider>,
  );
  return { ...view, onResult };
}

const startButton = () => screen.getByRole("button", { name: RO_START });

beforeEach(() => {
  FakeRecognition.instances = [];
  resetSoundStateForTests();
  resetAudioForTests();
  installSpeechRecognition();
  removeMicrophone();
});

afterEach(() => {
  removeSpeechRecognition();
  removeMicrophone();
});

/**
 * "No API, no button." A control that cannot do its one job is worse than no control: it
 * invites a press and then does nothing.
 */
describe("DictationButton — when the browser can't listen", () => {
  it("renders nothing at all without SpeechRecognition", () => {
    removeSpeechRecognition();

    const { container } = renderButton();

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders on a browser that only has the webkit-prefixed API", async () => {
    removeSpeechRecognition();
    installSpeechRecognition(true);

    renderButton();

    expect(await screen.findByRole("button", { name: RO_START })).toBeInTheDocument();
  });
});

/**
 * Nothing happens until the visitor says so — the requirement that separates a dictation
 * button from a bug report.
 */
describe("DictationButton — starts only on a click", () => {
  it("constructs no recogniser and asks for nothing on mount", () => {
    const getUserMedia = installMicrophone("granted");

    renderButton();

    expect(FakeRecognition.instances).toHaveLength(0);
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("starts one recogniser on a click, and shows that it is listening", async () => {
    const user = userEvent.setup();
    renderButton();

    await user.click(startButton());

    await waitFor(() => expect(FakeRecognition.instances).toHaveLength(1));
    expect(FakeRecognition.last.starts).toBe(1);
    expect(await screen.findByRole("button", { name: RO_STOP })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Ascult");
  });

  it("starts from the keyboard too", async () => {
    const user = userEvent.setup();
    renderButton();

    startButton().focus();
    await user.keyboard("{Enter}");

    await waitFor(() => expect(FakeRecognition.instances).toHaveLength(1));
  });

  it("listens in the language the visitor is reading", async () => {
    const user = userEvent.setup();
    renderButton({ locale: "ru" });

    await user.click(screen.getByRole("button", { name: "Продиктовать текст голосом" }));

    await waitFor(() => expect(FakeRecognition.last?.lang).toBe("ru-RU"));
  });

  it("does nothing when disabled", async () => {
    const user = userEvent.setup();
    renderButton({ disabled: true });

    await user.click(startButton());

    expect(FakeRecognition.instances).toHaveLength(0);
  });

  it("offers a way to stop, and stops on it", async () => {
    const user = userEvent.setup();
    renderButton();

    await user.click(startButton());
    const stop = await screen.findByRole("button", { name: RO_STOP });
    await user.click(stop);

    expect(FakeRecognition.last.stops).toBe(1);
    expect(await screen.findByRole("button", { name: RO_START })).toBeInTheDocument();
  });
});

/**
 * Permission is asked for out loud, and a refusal is a state the interface handles — never
 * a broken control or an empty stare.
 */
describe("DictationButton — permission", () => {
  it("asks for the microphone explicitly before listening", async () => {
    const getUserMedia = installMicrophone("granted");
    const user = userEvent.setup();
    renderButton();

    await user.click(startButton());

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledWith({ audio: true }));
  });

  it("keeps no audio: the permission stream is stopped immediately", async () => {
    const stop = vi.fn();
    installMicrophone("granted", stop);
    const user = userEvent.setup();
    renderButton();

    await user.click(startButton());

    await waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
  });

  it("explains a refusal and falls back to typing, without starting anything", async () => {
    installMicrophone("denied");
    const user = userEvent.setup();
    renderButton();

    await user.click(startButton());

    const status = await screen.findByRole("status");
    await waitFor(() => expect(status).toHaveTextContent(/refuzat/i));
    expect(status).toHaveTextContent(/manual/i);
    expect(FakeRecognition.instances).toHaveLength(0);
    // The control is still there, and still offers to try again.
    expect(screen.getByRole("button", { name: RO_START })).toBeInTheDocument();
  });

  it("survives a refusal raised by the recogniser itself", async () => {
    const user = userEvent.setup();
    renderButton();

    await user.click(startButton());
    await waitFor(() => expect(FakeRecognition.instances).toHaveLength(1));
    act(() => FakeRecognition.last.fail("not-allowed"));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/refuzat/i),
    );
    expect(screen.getByRole("button", { name: RO_START })).toBeInTheDocument();
  });

  it("reports a microphone that fails for any other reason", async () => {
    installMicrophone("broken");
    const user = userEvent.setup();
    renderButton();

    await user.click(startButton());

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/nu a pornit/i),
    );
  });

  it("says so when it heard nothing", async () => {
    const user = userEvent.setup();
    renderButton();

    await user.click(startButton());
    await waitFor(() => expect(FakeRecognition.instances).toHaveLength(1));
    act(() => FakeRecognition.last.fail("no-speech"));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/Nu am auzit/i),
    );
  });
});

/**
 * The text — the only thing that ever leaves this component — travels exactly one way:
 * into an editable box, and onward only when the visitor presses "add".
 */
describe("DictationButton — the visitor confirms the text", () => {
  async function dictate(phrase: string, onResult = vi.fn()) {
    const user = userEvent.setup();
    renderButton({ onResult });

    await user.click(startButton());
    await waitFor(() => expect(FakeRecognition.instances).toHaveLength(1));
    // The recogniser's own callbacks are what drive the component from here, so they run
    // inside act() — this is the browser calling React, not the test.
    act(() => {
      FakeRecognition.last.say(phrase);
      FakeRecognition.last.onend?.();
    });

    return { user, onResult };
  }

  it("puts the recognised text in an editable field and hands it over on confirmation", async () => {
    const { user, onResult } = await dictate("vreau un site de prezentare");

    const draft = await screen.findByRole("textbox");
    expect(draft).toHaveValue("vreau un site de prezentare");
    // Nothing has been handed over yet — recognising is not confirming.
    expect(onResult).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Adaugă în câmp" }));

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith("vreau un site de prezentare");
  });

  it("lets the visitor correct the recognition before it is used", async () => {
    const { user, onResult } = await dictate("vreau un sit");

    const draft = await screen.findByRole("textbox");
    await user.clear(draft);
    await user.type(draft, "vreau un site");
    await user.click(screen.getByRole("button", { name: "Adaugă în câmp" }));

    expect(onResult).toHaveBeenCalledWith("vreau un site");
  });

  it("hands over nothing when the visitor discards it", async () => {
    const { user, onResult } = await dictate("ceva greșit");

    await screen.findByRole("textbox");
    await user.click(screen.getByRole("button", { name: "Renunță" }));

    expect(onResult).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("promises, in writing, that no audio is stored or sent", async () => {
    await dictate("orice");

    expect(await screen.findByText(/Nu înregistrăm și nu trimitem sunet/i)).toBeInTheDocument();
  });

  it("does not open a review panel when nothing was recognised", async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    renderButton({ onResult });

    await user.click(startButton());
    await waitFor(() => expect(FakeRecognition.instances).toHaveLength(1));
    act(() => FakeRecognition.last.onend?.());

    await waitFor(() =>
      expect(screen.getByRole("button", { name: RO_START })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(onResult).not.toHaveBeenCalled();
  });
});
