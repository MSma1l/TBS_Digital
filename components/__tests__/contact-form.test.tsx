/**
 * The estimator's contact form — the only way a lead reaches the business.
 *
 * This file previously described an older estimator (different copy, a payload built from
 * the services list). That implementation was replaced by the chips-and-assistant design,
 * and in the rewrite the form lost **both** its client-side validation and its call to the
 * API: `onSubmit` did `preventDefault(); setSent(true)` and nothing else, so every visitor
 * saw a success state while the request went nowhere. These tests pin down the behaviour
 * that must never regress again:
 *
 *   1. an invalid form does not reach the network,
 *   2. a valid one does, exactly once, carrying what the visitor actually chose,
 *   3. a failure is visible and non-destructive.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Only the network layer is mocked. Validation stays REAL (@/lib/validation), so these
// tests exercise the rules the backend also enforces.
vi.mock("@/lib/api", () => ({
  submitContact: vi.fn(),
  isNetworkError: vi.fn(() => false),
  isUnauthorized: vi.fn(() => false),
  fetchContent: vi.fn(),
  saveContent: vi.fn(),
  login: vi.fn(),
  fetchMe: vi.fn(),
  fetchSubmissions: vi.fn(),
  deleteSubmission: vi.fn(),
  getToken: vi.fn(() => null),
  setToken: vi.fn(),
  clearToken: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

import * as api from "@/lib/api";
import { Estimator } from "@/components/sections/Estimator";
import { SiteContentProvider } from "@/lib/siteContent";

const NAME_PH = "Nume și companie";
const EMAIL_PH = "Email";
const PHONE_PH = "Telefon (opțional)";
const DETAILS_PH = "Adaugă orice detaliu important";
const SUBMIT = /Trimite cererea/;

function renderForm() {
  return render(
    <SiteContentProvider>
      <Estimator />
    </SiteContentProvider>,
  );
}

/** Fill the two required fields with acceptable values. */
async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText(NAME_PH), "Ion Popescu");
  await user.type(screen.getByPlaceholderText(EMAIL_PH), "ion@example.com");
}

beforeEach(() => {
  // The provider fetches content on mount; reject so it keeps the bundled defaults.
  vi.mocked(api.fetchContent).mockRejectedValue(new Error("offline"));
  vi.mocked(api.isNetworkError).mockReturnValue(false);
  vi.mocked(api.submitContact).mockResolvedValue(undefined);
});

describe("fields", () => {
  it("renders name, email, phone, details and a submit button", () => {
    renderForm();
    expect(screen.getByPlaceholderText(NAME_PH)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(EMAIL_PH)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(PHONE_PH)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(DETAILS_PH)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: SUBMIT })).toBeEnabled();
  });
});

describe("validation — nothing invalid reaches the network", () => {
  it("refuses an empty form and names both missing fields", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: SUBMIT }));

    expect(screen.getByText("Numele este obligatoriu.")).toBeInTheDocument();
    expect(screen.getByText("Emailul este obligatoriu.")).toBeInTheDocument();
    expect(api.submitContact).not.toHaveBeenCalled();
  });

  it("rejects a malformed email", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText(NAME_PH), "Ion Popescu");
    await user.type(screen.getByPlaceholderText(EMAIL_PH), "not-an-email");
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    expect(screen.getByText("Introdu o adresă de email validă.")).toBeInTheDocument();
    expect(api.submitContact).not.toHaveBeenCalled();
  });

  it("rejects markup smuggled into a field", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText(NAME_PH), "<script>x</script>");
    await user.type(screen.getByPlaceholderText(EMAIL_PH), "ion@example.com");
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    expect(
      screen.getByText("Numele conține caractere sau cod nepermis."),
    ).toBeInTheDocument();
    expect(api.submitContact).not.toHaveBeenCalled();
  });

  it("accepts a blank phone — it is optional — but rejects a malformed one", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillValid(user);
    await user.type(screen.getByPlaceholderText(PHONE_PH), "abc");
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    expect(screen.getByText("Introdu un număr de telefon valid.")).toBeInTheDocument();
    expect(api.submitContact).not.toHaveBeenCalled();
  });

  it("clears a field's message as soon as it is edited", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: SUBMIT }));
    expect(screen.getByText("Numele este obligatoriu.")).toBeInTheDocument();

    // Otherwise "is required" sits under a field the visitor has just filled in.
    await user.type(screen.getByPlaceholderText(NAME_PH), "I");
    expect(screen.queryByText("Numele este obligatoriu.")).not.toBeInTheDocument();
    // The other field's message is untouched — only the edited one clears.
    expect(screen.getByText("Emailul este obligatoriu.")).toBeInTheDocument();
  });

  it("marks the offending field with aria-invalid", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: SUBMIT }));

    expect(screen.getByPlaceholderText(NAME_PH)).toHaveAttribute("aria-invalid", "true");
  });
});

describe("submit — the request actually leaves", () => {
  it("posts once and carries the project type and estimate", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillValid(user);
    await user.type(screen.getByPlaceholderText(PHONE_PH), "+373 600 00 000");
    await user.type(screen.getByPlaceholderText(DETAILS_PH), "Vreau un site nou.");
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    expect(await screen.findByText(/Am primit cererea/)).toBeInTheDocument();
    expect(api.submitContact).toHaveBeenCalledTimes(1);
    expect(api.submitContact).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Ion Popescu",
        email: "ion@example.com",
        phone: "+373 600 00 000",
        project: "Site / prezentare",
        estimate: "€3.000",
      }),
    );
  });

  it("includes the chosen options in the message", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillValid(user);
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    const payload = vi.mocked(api.submitContact).mock.calls[0][0];
    expect(payload.message).toContain("Opțiuni alese");
    expect(payload.message).toContain("+ Integrări & API"); // the default selection
  });

  it("includes the assistant dialog, which the UI promises is attached", async () => {
    const user = userEvent.setup();
    renderForm();

    // Answer the first question of the assistant, then send.
    const firstAnswer = screen.getAllByRole("button").find((b) => /buget/i.test(b.textContent ?? ""));
    if (firstAnswer) await user.click(firstAnswer);

    await fillValid(user);
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    const payload = vi.mocked(api.submitContact).mock.calls[0][0];
    if (firstAnswer) expect(payload.message).toContain("Dialog");
  });

  it("cannot be double-submitted", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillValid(user);
    const button = screen.getByRole("button", { name: SUBMIT });
    await user.click(button);
    await screen.findByText(/Am primit cererea/);
    // The button is disabled after success, so a second click is a no-op.
    expect(screen.getByRole("button", { name: /Cerere trimisă/ })).toBeDisabled();
    expect(api.submitContact).toHaveBeenCalledTimes(1);
  });
});

describe("failure — visible, and nothing is lost", () => {
  it("reports a network failure and keeps what was typed", async () => {
    const user = userEvent.setup();
    vi.mocked(api.submitContact).mockRejectedValue(new Error("offline"));
    vi.mocked(api.isNetworkError).mockReturnValue(true);
    renderForm();

    await fillValid(user);
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    expect(await screen.findByText(/Nu am putut contacta serverul/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(NAME_PH)).toHaveValue("Ion Popescu");
    expect(screen.queryByText(/Am primit cererea/)).not.toBeInTheDocument();
  });

  it("explains a 429 as rate limiting rather than a broken form", async () => {
    const user = userEvent.setup();
    vi.mocked(api.submitContact).mockRejectedValue(new api.ApiError(429, "Too Many Requests"));
    vi.mocked(api.isNetworkError).mockReturnValue(false);
    renderForm();

    await fillValid(user);
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    expect(await screen.findByText(/Prea multe cereri/)).toBeInTheDocument();
  });

  it("falls back to a generic message for any other error", async () => {
    const user = userEvent.setup();
    vi.mocked(api.submitContact).mockRejectedValue(new Error("boom"));
    vi.mocked(api.isNetworkError).mockReturnValue(false);
    renderForm();

    await fillValid(user);
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    expect(await screen.findByText(/Cererea nu a putut fi trimisă/)).toBeInTheDocument();
  });
});
