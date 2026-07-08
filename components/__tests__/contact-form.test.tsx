import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock the network layer so no real HTTP happens. Validation/sanitization stay
// REAL (imported from @/lib/validation) — we are testing the form's UX against
// the actual rules.
vi.mock("@/lib/api", () => ({
  submitContact: vi.fn(),
  isNetworkError: vi.fn(() => false),
  isUnauthorized: vi.fn(() => false),
  fetchContent: vi.fn(),
  saveContent: vi.fn(),
  login: vi.fn(),
  fetchMe: vi.fn(),
  fetchSubmissions: vi.fn(),
  getToken: vi.fn(() => null),
  setToken: vi.fn(),
  clearToken: vi.fn(),
}));

import * as api from "@/lib/api";
import { Estimator } from "@/components/sections/Estimator";
import { SiteContentProvider } from "@/lib/siteContent";

const NAME_PH = "Nume și prenume";
const EMAIL_PH = "Email";
const PHONE_PH = "Telefon (opțional)";
const MSG_PH = "Spune-ne despre proiectul tău...";
const SUBMIT = /Trimite cererea/;

function renderForm() {
  return render(
    <SiteContentProvider>
      <Estimator />
    </SiteContentProvider>,
  );
}

beforeEach(() => {
  // Provider fetches content on mount; reject so it keeps the built-in defaults
  // (which include the full services list the estimator relies on).
  vi.mocked(api.fetchContent).mockRejectedValue(new Error("offline"));
  vi.mocked(api.isNetworkError).mockReturnValue(false);
});

describe("Estimator contact form — fields", () => {
  it("renders name, email, phone, message and a submit button", () => {
    renderForm();
    expect(screen.getByPlaceholderText(NAME_PH)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(EMAIL_PH)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(PHONE_PH)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(MSG_PH)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: SUBMIT })).toBeInTheDocument();
  });
});

describe("Estimator contact form — validation UX", () => {
  it("shows Romanian required errors and does NOT submit empty required fields", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: SUBMIT }));

    expect(screen.getByText("Numele este obligatoriu.")).toBeInTheDocument();
    expect(screen.getByText("Emailul este obligatoriu.")).toBeInTheDocument();
    expect(screen.getByText("Mesajul este obligatoriu.")).toBeInTheDocument();
    expect(api.submitContact).not.toHaveBeenCalled();
  });

  it("rejects an invalid email address", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText(NAME_PH), "Ion Popescu");
    await user.type(screen.getByPlaceholderText(EMAIL_PH), "not-an-email");
    await user.type(screen.getByPlaceholderText(MSG_PH), "Salut, vreau un site.");
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    expect(
      screen.getByText("Introdu o adresă de email validă."),
    ).toBeInTheDocument();
    expect(api.submitContact).not.toHaveBeenCalled();
  });

  it("blocks dangerous markup input (e.g. <script>)", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText(NAME_PH), "<script>x</script>");
    await user.type(screen.getByPlaceholderText(EMAIL_PH), "ion@example.com");
    await user.type(screen.getByPlaceholderText(MSG_PH), "Mesaj valid.");
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    expect(
      screen.getByText("Numele conține caractere sau cod nepermis."),
    ).toBeInTheDocument();
    expect(api.submitContact).not.toHaveBeenCalled();
  });

  it("leaves the submit button enabled for valid input", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText(NAME_PH), "Ion Popescu");
    await user.type(screen.getByPlaceholderText(EMAIL_PH), "ion@example.com");
    await user.type(screen.getByPlaceholderText(MSG_PH), "Vreau un site.");

    expect(screen.getByRole("button", { name: SUBMIT })).toBeEnabled();
  });
});

describe("Estimator contact form — submit flow", () => {
  it("submits a sanitized payload once and shows the success state", async () => {
    const user = userEvent.setup();
    vi.mocked(api.submitContact).mockResolvedValue(undefined);
    renderForm();

    // Trailing whitespace should be trimmed by sanitizeText before sending.
    await user.type(screen.getByPlaceholderText(NAME_PH), "Ion Popescu ");
    await user.type(screen.getByPlaceholderText(EMAIL_PH), "ion@example.com");
    await user.type(screen.getByPlaceholderText(PHONE_PH), "+373 600 00 000");
    await user.type(screen.getByPlaceholderText(MSG_PH), "Vreau un site nou.");
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    // Success state ("Mulțumim!") replaces the form.
    expect(await screen.findByText("Mulțumim!")).toBeInTheDocument();

    expect(api.submitContact).toHaveBeenCalledTimes(1);
    expect(api.submitContact).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Ion Popescu",
        email: "ion@example.com",
        phone: "+373 600 00 000",
        message: "Vreau un site nou.",
        project: "Site web / prezentare",
        estimate: "...",
      }),
    );
  });

  it("shows an error state without losing the form when submit rejects", async () => {
    const user = userEvent.setup();
    vi.mocked(api.submitContact).mockRejectedValue(new Error("boom"));
    vi.mocked(api.isNetworkError).mockReturnValue(false);
    renderForm();

    await user.type(screen.getByPlaceholderText(NAME_PH), "Ion Popescu");
    await user.type(screen.getByPlaceholderText(EMAIL_PH), "ion@example.com");
    await user.type(screen.getByPlaceholderText(MSG_PH), "Vreau un site nou.");
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    expect(
      await screen.findByText("Trimiterea a eșuat. Te rugăm să încerci din nou."),
    ).toBeInTheDocument();
    // Form is preserved with the typed values still present.
    expect(screen.getByPlaceholderText(NAME_PH)).toHaveValue("Ion Popescu");
    expect(screen.queryByText("Mulțumim!")).not.toBeInTheDocument();
  });
});
