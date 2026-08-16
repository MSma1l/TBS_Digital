import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreferencesGroup } from "@/components/ui/PreferencesGroup";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { messages } from "@/lib/i18n/messages";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import type { Locale } from "@/lib/i18n/locales";
import {
  MAX_TONE_DURATION,
  SOUND_COOKIE,
  TONES,
  isSoundEnabled,
  playSound,
  readSoundChoice,
  resetAudioForTests,
  resetSoundStateForTests,
  resolveTone,
  setSoundChoice,
} from "@/lib/sound";

/**
 * The sound toggle's whole contract is negative: by default the site is silent, and it stays
 * silent until the visitor asks otherwise *and* touches the page. So most of these tests
 * assert that nothing happened — which is only meaningful with a real spy on the audio
 * layer. That is what the fake AudioContext below is: it records every tone that would have
 * been produced, so "silent" is a fact rather than an assumption.
 */

const RO_ARIA = "Sunet interfață";
const RO_ON = "Pornește sunetul";
const RO_OFF = "Oprește sunetul";

type PlayedTone = { freq: number; duration: number; peakGain: number };

const contexts: FakeAudioContext[] = [];
const played: PlayedTone[] = [];

class FakeParam {
  value = 0;
  private peak = 0;
  private stopAt = 0;
  constructor(private readonly onEnvelope: (peak: number, stopAt: number) => void) {}
  setValueAtTime(value: number) {
    this.value = value;
  }
  exponentialRampToValueAtTime(value: number, at: number) {
    // The envelope ramps up to the peak and back down to ~0; the second ramp's time is the
    // tone's duration, which is what the "short and subtle" requirement is about.
    if (value > this.peak) this.peak = value;
    else {
      this.stopAt = at;
      this.onEnvelope(this.peak, this.stopAt);
    }
  }
}

class FakeOscillator {
  type = "";
  frequency = { setValueAtTime: (v: number) => (this.freq = v) };
  freq = 0;
  onended: (() => void) | null = null;
  connect() {}
  disconnect() {}
  start() {}
  stop() {}
}

class FakeAudioContext {
  state = "running";
  currentTime = 0;
  destination = {};
  oscillator: FakeOscillator | null = null;
  constructor() {
    contexts.push(this);
  }
  createOscillator() {
    this.oscillator = new FakeOscillator();
    return this.oscillator;
  }
  createGain() {
    return {
      gain: new FakeParam((peak, stopAt) =>
        played.push({ freq: this.oscillator?.freq ?? 0, duration: stopAt, peakGain: peak }),
      ),
      connect: () => {},
      disconnect: () => {},
    };
  }
  resume() {}
  close() {}
}

const realAudioContext = (window as unknown as { AudioContext?: unknown }).AudioContext;
const realMatchMedia = window.matchMedia;

function setAudioContext(ctor: unknown) {
  (window as unknown as { AudioContext?: unknown }).AudioContext = ctor;
}

/** Pretend the OS asks for reduced motion (or doesn't). */
function mockReducedMotion(reduced: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduced && query.includes("reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

function renderPrefs({ locale = "ro" as Locale } = {}) {
  return render(
    <ThemeProvider initialChoice="light">
      <LanguageProvider initialLocale={locale}>
        <PreferencesGroup />
      </LanguageProvider>
    </ThemeProvider>,
  );
}

const soundButton = () => screen.getByRole("button", { name: RO_ARIA });
const savedChoice = () => readSoundChoice(document.cookie);

beforeEach(() => {
  resetSoundStateForTests();
  resetAudioForTests();
  contexts.length = 0;
  played.length = 0;
  document.cookie = `${SOUND_COOKIE}=;path=/;max-age=0`;
  setAudioContext(FakeAudioContext);
});

afterEach(() => {
  setAudioContext(realAudioContext);
  window.matchMedia = realMatchMedia;
  resetSoundStateForTests();
  resetAudioForTests();
});

/**
 * Default off is the headline requirement: a visitor who has never touched the control must
 * get a site that makes no noise at all.
 */
describe("SoundToggle — off by default", () => {
  it("renders unpressed, offering to turn sound on", () => {
    renderPrefs();

    const button = soundButton();
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveAttribute("title", RO_ON);
    expect(isSoundEnabled()).toBe(false);
  });

  it("plays nothing while it is off, however loudly it is asked to", async () => {
    const user = userEvent.setup();
    renderPrefs();

    // A real interaction has happened (so the gesture latch is open) — the only thing
    // keeping the page silent here is the setting itself.
    await user.click(screen.getByRole("button", { name: "English" }));

    expect(playSound("tap")).toBe(false);
    expect(playSound("confirm")).toBe(false);
    expect(contexts).toHaveLength(0);
    expect(played).toHaveLength(0);
  });
});

/**
 * No autoplay, stated three ways: on mount, on mount with the setting already on, and from
 * a call that arrives before the visitor has touched anything.
 */
describe("sound never plays on its own", () => {
  it("makes no sound and builds no AudioContext when the page loads", () => {
    renderPrefs();

    expect(contexts).toHaveLength(0);
    expect(played).toHaveLength(0);
  });

  it("stays silent on load even for a returning visitor whose choice was 'on'", () => {
    document.cookie = `${SOUND_COOKIE}=on;path=/`;

    renderPrefs();

    // The setting is restored…
    expect(soundButton()).toHaveAttribute("aria-pressed", "true");
    // …but the page has made no sound, because nobody has interacted with it yet.
    expect(playSound("tap")).toBe(false);
    expect(contexts).toHaveLength(0);
    expect(played).toHaveLength(0);
  });

  it("refuses to play before the first user gesture, even with sound enabled", () => {
    setSoundChoice("on");
    // In the app, `setSoundChoice` is only ever reached from a click, so it opens the
    // gesture latch itself. Closing it again is how a test models the one state a browser
    // would otherwise have to produce: sound enabled, document not yet touched.
    resetAudioForTests();

    expect(isSoundEnabled()).toBe(true);
    expect(playSound("tap")).toBe(false);
    expect(contexts).toHaveLength(0);
  });
});

/**
 * The AudioContext is the expensive, browser-throttled part. It must appear at the first
 * tone that actually plays, and not one moment earlier.
 */
describe("the AudioContext is built lazily", () => {
  it("is created on the first real tone, not on mount", async () => {
    const user = userEvent.setup();
    renderPrefs();

    expect(contexts).toHaveLength(0);

    await user.click(soundButton());

    expect(contexts).toHaveLength(1);
    expect(played).toHaveLength(1);
  });

  it("survives a browser with no Web Audio at all", async () => {
    setAudioContext(undefined);
    const user = userEvent.setup();
    renderPrefs();

    await user.click(soundButton());

    // The setting still flips; only the sound is missing, and nothing threw.
    expect(soundButton()).toHaveAttribute("aria-pressed", "true");
    expect(played).toHaveLength(0);
  });
});

/**
 * Persistence, the same model as the theme: a cookie, so it survives a real reload and not
 * merely a re-render.
 */
describe("SoundToggle — the choice persists", () => {
  it("writes the choice to the cookie when turned on", async () => {
    const user = userEvent.setup();
    renderPrefs();

    await user.click(soundButton());

    expect(document.cookie).toContain(`${SOUND_COOKIE}=on`);
    expect(savedChoice()).toBe("on");
  });

  it("drops the cookie when turned back off, so 'no cookie' means silence", async () => {
    const user = userEvent.setup();
    renderPrefs();

    await user.click(soundButton());
    await user.click(soundButton());

    expect(savedChoice()).toBe("off");
    expect(soundButton()).toHaveAttribute("aria-pressed", "false");
  });

  it("comes back on after a reload", async () => {
    const user = userEvent.setup();
    const first = renderPrefs();

    await user.click(soundButton());
    expect(savedChoice()).toBe("on");

    // --- reload: the document (and this session's in-memory state) is thrown away, the
    // cookie is not ---
    first.unmount();
    resetSoundStateForTests();
    resetAudioForTests();
    contexts.length = 0;
    played.length = 0;

    renderPrefs();

    expect(soundButton()).toHaveAttribute("aria-pressed", "true");
    // …and the fresh document is still silent until it is touched.
    expect(played).toHaveLength(0);
  });
});

/**
 * What the toggle does the moment it is pressed: one short tone, because the visitor just
 * asked a question ("what does sound on sound like?") that only a sound can answer.
 */
describe("SoundToggle — feedback on press", () => {
  it("plays exactly one short tone when switched on, and none when switched off", async () => {
    const user = userEvent.setup();
    renderPrefs();

    await user.click(soundButton());
    expect(played).toHaveLength(1);
    expect(played[0].duration).toBeLessThanOrEqual(MAX_TONE_DURATION);

    await user.click(soundButton());
    expect(played).toHaveLength(1);
  });

  it("keeps every tone in the table short and quiet", () => {
    for (const [name, tone] of Object.entries(TONES)) {
      expect(tone.duration, `${name} duration`).toBeLessThanOrEqual(MAX_TONE_DURATION);
      expect(tone.gain, `${name} gain`).toBeLessThan(0.2);
    }
  });

  it("plays quieter and shorter when the visitor asked for reduced motion", async () => {
    mockReducedMotion(true);
    const user = userEvent.setup();
    renderPrefs();

    await user.click(soundButton());

    expect(played).toHaveLength(1);
    expect(played[0].peakGain).toBeLessThan(TONES.toggle.gain);
    expect(played[0].duration).toBeLessThan(TONES.toggle.duration);

    const reduced = resolveTone("toggle", true);
    expect(reduced.gain).toBeLessThan(TONES.toggle.gain);
    expect(reduced.duration).toBeLessThan(TONES.toggle.duration);
  });

  it("still does not start sound by itself under reduced motion", () => {
    mockReducedMotion(true);
    renderPrefs();

    expect(soundButton()).toHaveAttribute("aria-pressed", "false");
    expect(played).toHaveLength(0);
  });
});

/**
 * The hook is the deliverable other components consume, so its no-op contract is pinned
 * directly, not only through the button.
 */
describe("playSound() — the shared entry point", () => {
  it("is a no-op that reports it did nothing when sound is off", async () => {
    const user = userEvent.setup();
    renderPrefs();
    await user.click(screen.getByRole("button", { name: "English" }));

    expect(playSound()).toBe(false);
  });

  it("plays once sound is on and the visitor has interacted", async () => {
    const user = userEvent.setup();
    renderPrefs();

    await user.click(soundButton()); // turns it on (and plays the confirmation)
    played.length = 0;

    expect(playSound("tap")).toBe(true);
    expect(played).toHaveLength(1);
    expect(played[0].freq).toBe(TONES.tap.freq);
  });
});

/**
 * A control nobody can reach with a keyboard is not a control — and it has to be announced
 * in the language the visitor is reading.
 */
describe("SoundToggle — accessibility", () => {
  it("sits in the preferences group, right after the theme toggle", () => {
    renderPrefs();

    const prefs = screen.getByRole("group", { name: /Preferences/ });
    const sound = within(prefs).getByRole("button", { name: RO_ARIA });
    const theme = within(prefs).getByRole("button", {
      name: messages.ro["theme.toggleAria"],
    });

    expect(theme.nextElementSibling).toBe(sound);
  });

  it("switches with Enter", async () => {
    const user = userEvent.setup();
    renderPrefs();

    soundButton().focus();
    await user.keyboard("{Enter}");

    expect(soundButton()).toHaveAttribute("aria-pressed", "true");
    expect(savedChoice()).toBe("on");
  });

  it("switches with Space", async () => {
    const user = userEvent.setup();
    renderPrefs();

    soundButton().focus();
    await user.keyboard("[Space]");

    expect(soundButton()).toHaveAttribute("aria-pressed", "true");
  });

  it("is reachable by Tab", async () => {
    const user = userEvent.setup();
    renderPrefs();

    const target = soundButton();
    const order: Element[] = [];
    for (let i = 0; i < 25; i += 1) {
      await user.tab();
      const active = document.activeElement;
      if (!active || active === document.body) break;
      order.push(active);
      if (active === target) break;
    }

    expect(order).toContain(target);
  });

  it("is labelled and explained in the visitor's language", async () => {
    const user = userEvent.setup();
    renderPrefs({ locale: "ru" });

    const button = screen.getByRole("button", { name: "Звук интерфейса" });
    expect(button).toHaveAttribute("title", "Включить звук");

    await user.click(button);
    expect(button).toHaveAttribute("title", "Выключить звук");
  });

  it("is labelled in English for an English visitor", () => {
    renderPrefs({ locale: "en" });

    const button = screen.getByRole("button", { name: "Interface sound" });
    expect(button).toHaveAttribute("title", "Turn sound on");
  });

  it("says what a press would do, in Romanian, in both states", async () => {
    const user = userEvent.setup();
    renderPrefs();

    expect(soundButton()).toHaveAttribute("title", RO_ON);
    await user.click(soundButton());
    expect(soundButton()).toHaveAttribute("title", RO_OFF);
  });
});
