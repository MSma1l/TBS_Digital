/**
 * The request-flow dialog (`components/ui/Modal.tsx`).
 *
 * A modal is the one component where "looks right" and "is right" diverge hardest: a
 * div with a dark overlay behind it *looks* like a dialog while a keyboard user tabs
 * straight out of it into the page underneath, a screen reader announces nothing, and
 * the page scrolls away behind the sheet. These tests pin the behaviour that makes it
 * an actual dialog:
 *
 *   1. it is announced as one — role, aria-modal, and a name from its own heading,
 *   2. focus goes in, stays in, and comes back out to whatever opened it,
 *   3. it closes on every affordance a visitor will try (✕ / Escape / backdrop) and
 *      on none of the gestures that only look like one (a drag released on the backdrop),
 *   4. the page behind it neither scrolls nor shifts, and is restored exactly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useRef, useState, type RefObject } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "@/components/ui/Modal";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import type { Locale } from "@/lib/i18n/locales";

const TITLE = {
  ro: "Trimite cererea",
  ru: "Отправить заявку",
  en: "Send the request",
};
const DESCRIPTION = {
  ro: "Completează datele și revenim într-o zi lucrătoare.",
  ru: "Заполните данные, и мы ответим в течение рабочего дня.",
  en: "Fill in the details and we'll get back within a business day.",
};

const OPEN_LABEL = "Deschide cererea";
const CLOSE_LABEL = "Închide";

const NAME_LABEL = "Nume";
const EMAIL_LABEL = "Email";
const SEND_LABEL = "Trimite";
const OUTSIDE_LABEL = "Link din pagina de sub modal";

/** The dialog element, and a `within()` scoped to it. */
const dialog = () => screen.getByRole("dialog");
const overlay = () => screen.getByTestId("modal-overlay");

/**
 * A page the way the app will use the modal: a CTA that opens it, a focusable element
 * *outside* it (which the trap must never reach), and a small form inside.
 */
function Harness({
  onCloseSpy,
  focusEmailFirst = false,
  closeOnOverlayClick,
  closeOnEscape,
  withDescription = true,
  locale = "ro" as Locale,
}: {
  onCloseSpy?: () => void;
  focusEmailFirst?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  withDescription?: boolean;
  locale?: Locale;
}) {
  const [open, setOpen] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  return (
    <LanguageProvider initialLocale={locale}>
      <button type="button" onClick={() => setOpen(true)}>
        {OPEN_LABEL}
      </button>
      <a href="#altundeva">{OUTSIDE_LABEL}</a>

      <Modal
        open={open}
        onClose={() => {
          onCloseSpy?.();
          setOpen(false);
        }}
        title={TITLE}
        description={withDescription ? DESCRIPTION : undefined}
        eyebrow={{ ro: "Cerere", ru: "Заявка", en: "Request" }}
        initialFocusRef={
          focusEmailFirst ? (emailRef as RefObject<HTMLElement | null>) : undefined
        }
        closeOnOverlayClick={closeOnOverlayClick}
        closeOnEscape={closeOnEscape}
        footer={
          <button type="button" onClick={() => onCloseSpy?.()}>
            {SEND_LABEL}
          </button>
        }
      >
        <label>
          {NAME_LABEL}
          <input name="name" />
        </label>
        <label>
          {EMAIL_LABEL}
          <input name="email" ref={emailRef} />
        </label>
      </Modal>
    </LanguageProvider>
  );
}

/** Renders the page and presses the CTA, so every test starts from an open dialog. */
async function openModal(props: Parameters<typeof Harness>[0] = {}) {
  const user = userEvent.setup();
  render(<Harness {...props} />);
  const trigger = screen.getByRole("button", { name: OPEN_LABEL });
  await user.click(trigger);
  return { user, trigger };
}

/* jsdom has no layout and no real scrolling: `scrollTo` is unimplemented (it warns on
   every call) and the viewport/scrollbar sizes the lock reads are 0. Give it a page that
   is scrolled down behind a 15px scrollbar, so the lock has something real to restore. */
const SCROLL_Y = 320;
const VIEWPORT = 1024;
const SCROLLBAR = 15;

let scrollToSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  scrollToSpy = vi.fn();
  Object.defineProperty(window, "scrollTo", { value: scrollToSpy, configurable: true });
  Object.defineProperty(window, "scrollY", { value: SCROLL_Y, configurable: true });
  Object.defineProperty(window, "innerWidth", { value: VIEWPORT, configurable: true });
  Object.defineProperty(document.documentElement, "clientWidth", {
    value: VIEWPORT - SCROLLBAR,
    configurable: true,
  });
});

afterEach(() => {
  document.body.removeAttribute("style");
});

describe("Modal — accessibility contract", () => {
  it("renders nothing until it is opened", () => {
    render(<Harness />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("is a dialog named by its own heading and described by its lead", async () => {
    await openModal();

    const node = dialog();
    expect(node).toHaveAttribute("aria-modal", "true");

    // The name comes from the rendered <h2>, not a duplicated aria-label.
    const heading = screen.getByRole("heading", { name: TITLE.ro });
    expect(node).toHaveAttribute("aria-labelledby", heading.id);
    expect(node).toHaveAccessibleName(TITLE.ro);

    const description = screen.getByText(DESCRIPTION.ro);
    expect(node).toHaveAttribute("aria-describedby", description.id);
    expect(node).toHaveAccessibleDescription(DESCRIPTION.ro);
  });

  it("omits aria-describedby when no description was given", async () => {
    await openModal({ withDescription: false });
    expect(dialog()).not.toHaveAttribute("aria-describedby");
  });

  it("localizes the copy it owns", async () => {
    await openModal({ locale: "ru" });

    expect(screen.getByRole("heading", { name: TITLE.ru })).toBeInTheDocument();
    // The ✕ has no text, so its name is the only thing a screen reader gets.
    expect(screen.getByRole("button", { name: "Закрыть" })).toBeInTheDocument();
  });
});

describe("Modal — focus", () => {
  it("moves focus into the dialog on open", async () => {
    await openModal();

    const close = within(dialog()).getByRole("button", { name: CLOSE_LABEL });
    expect(close).toHaveFocus();
    expect(dialog()).toContainElement(document.activeElement as HTMLElement);
  });

  it("honours initialFocusRef over the first focusable element", async () => {
    await openModal({ focusEmailFirst: true });
    expect(screen.getByLabelText(EMAIL_LABEL)).toHaveFocus();
  });

  it("cycles Tab inside the dialog and never leaves it", async () => {
    const { user } = await openModal();

    const node = dialog();
    const close = within(node).getByRole("button", { name: CLOSE_LABEL });
    const name = screen.getByLabelText(NAME_LABEL);
    const email = screen.getByLabelText(EMAIL_LABEL);
    const send = within(node).getByRole("button", { name: SEND_LABEL });

    // One full lap: last element wraps back to the first.
    const lap = [name, email, send, close];
    for (const expected of lap) {
      await user.tab();
      expect(expected).toHaveFocus();
    }

    // And it keeps holding — several more laps never reach the page behind.
    const outside = screen.getByRole("link", { name: OUTSIDE_LABEL });
    const trigger = screen.getByRole("button", { name: OPEN_LABEL });
    for (let i = 0; i < 8; i++) {
      await user.tab();
      expect(node).toContainElement(document.activeElement as HTMLElement);
      expect(document.activeElement).not.toBe(outside);
      expect(document.activeElement).not.toBe(trigger);
    }
  });

  it("cycles Shift+Tab backwards, wrapping from the first element to the last", async () => {
    const { user } = await openModal();

    const node = dialog();
    const close = within(node).getByRole("button", { name: CLOSE_LABEL });
    const send = within(node).getByRole("button", { name: SEND_LABEL });

    expect(close).toHaveFocus();

    await user.tab({ shift: true });
    expect(send).toHaveFocus();

    await user.tab({ shift: true });
    expect(screen.getByLabelText(EMAIL_LABEL)).toHaveFocus();
  });

  it("returns focus to the element that opened it", async () => {
    const { user, trigger } = await openModal();
    expect(trigger).not.toHaveFocus();

    await user.click(within(dialog()).getByRole("button", { name: CLOSE_LABEL }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

describe("Modal — closing", () => {
  it("closes on the ✕", async () => {
    const onCloseSpy = vi.fn();
    const { user } = await openModal({ onCloseSpy });

    await user.click(within(dialog()).getByRole("button", { name: CLOSE_LABEL }));

    expect(onCloseSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const onCloseSpy = vi.fn();
    const { user, trigger } = await openModal({ onCloseSpy });

    await user.keyboard("{Escape}");

    expect(onCloseSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("ignores Escape when closeOnEscape is off", async () => {
    const onCloseSpy = vi.fn();
    const { user } = await openModal({ onCloseSpy, closeOnEscape: false });

    await user.keyboard("{Escape}");

    expect(onCloseSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeInTheDocument();
  });

  it("closes on a click on the backdrop", async () => {
    const onCloseSpy = vi.fn();
    const { user } = await openModal({ onCloseSpy });

    await user.click(overlay());

    expect(onCloseSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not close on a click inside the dialog", async () => {
    const onCloseSpy = vi.fn();
    const { user } = await openModal({ onCloseSpy });

    await user.click(screen.getByLabelText(NAME_LABEL));
    await user.click(screen.getByText(DESCRIPTION.ro));
    await user.click(dialog());

    expect(onCloseSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeInTheDocument();
  });

  /**
   * The regression this component exists to avoid: press inside the panel (selecting
   * text, dragging a control), release over the backdrop. The browser fires `click`
   * on the nearest common ancestor — the overlay — so a naive
   * `target === currentTarget` check would throw the visitor's half-filled form away.
   * Modelled with raw events because that ancestor retarget is browser behaviour, not
   * something a synthetic "click here" helper reproduces.
   */
  it("does not close when a drag starts inside and is released on the backdrop", async () => {
    const onCloseSpy = vi.fn();
    await openModal({ onCloseSpy });

    fireEvent.pointerDown(screen.getByLabelText(NAME_LABEL));
    fireEvent.click(overlay());

    expect(onCloseSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeInTheDocument();
  });

  it("ignores backdrop clicks when closeOnOverlayClick is off", async () => {
    const onCloseSpy = vi.fn();
    const { user } = await openModal({ onCloseSpy, closeOnOverlayClick: false });

    await user.click(overlay());

    expect(onCloseSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeInTheDocument();
  });
});

describe("Modal — background scroll", () => {
  it("freezes the page while open and restores it exactly on close", async () => {
    const { user } = await openModal();

    const body = document.body;
    expect(body.style.overflow).toBe("hidden");
    // Pinned rather than merely `overflow: hidden` — iOS Safari ignores the latter.
    expect(body.style.position).toBe("fixed");
    expect(body.style.top).toBe(`-${SCROLL_Y}px`);
    // The scrollbar the pin removed is paid back as padding, so nothing shifts sideways.
    expect(body.style.paddingRight).toBe(`${SCROLLBAR}px`);

    await user.keyboard("{Escape}");

    expect(body.style.overflow).toBe("");
    expect(body.style.position).toBe("");
    expect(body.style.top).toBe("");
    expect(body.style.paddingRight).toBe("");
    expect(scrollToSpy).toHaveBeenCalledWith(0, SCROLL_Y);
  });

  it("leaves inline body styles it did not set untouched", async () => {
    document.body.style.background = "red";
    const { user } = await openModal();

    await user.keyboard("{Escape}");

    expect(document.body.style.background).toBe("red");
    expect(document.body.style.overflow).toBe("");
  });
});
