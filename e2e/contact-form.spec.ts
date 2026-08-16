import { expect, test, type Locator, type Page } from "@playwright/test";
import { estimatorForm, forbidContactApi, gotoHydrated, stubContactApi } from "./helpers";

/*
 * The request form in the `#estimare` section of the home page.
 *
 * SAFETY: every test here stubs `POST /api/contact` with `page.route()`. A real submission
 * would create a real lead in whatever backend the build points at, so the network call is
 * intercepted and inspected in the browser and NEVER leaves it. The negative test goes one
 * step further and fails if the endpoint is touched at all.
 *
 * Fields are located structurally (input types, the single form button) rather than by their
 * placeholder copy: the copy is trilingual and gets reworded, the shape does not.
 */

const fields = (page: Page) => {
  const form = estimatorForm(page);
  return {
    form,
    // The name input is the only one with no explicit `type`.
    name: form.getByRole("textbox").first(),
    email: form.locator('input[type="email"]'),
    phone: form.locator('input[type="tel"]'),
    details: form.locator("textarea"),
    // `button[type=submit]` rather than "the button": the details field can host an extra
    // control (dictation) inside the same form.
    submit: form.locator('button[type="submit"]'),
  };
};

/** Every inline validation message the form is currently showing. */
const errors = (form: Locator): Locator => form.getByRole("alert");

/**
 * The "we got your request" note. Filtered to live regions that actually SAY something: the
 * dictation control mounts an always-present, usually-empty `role="status"` inside the same
 * form, and an empty announcement is not a success message.
 */
const sentNote = (form: Locator): Locator =>
  form.getByRole("status").filter({ hasText: /\S/ });

test.describe("contact / estimate form", () => {
  test("an empty form shows validation messages and sends nothing", async ({ page }) => {
    const assertNoRequest = await forbidContactApi(page);
    await gotoHydrated(page, "/#estimare");

    const f = fields(page);
    await expect(f.form).toBeVisible();

    await f.submit.click();

    // Name and email are required, phone is not — so exactly the two required fields are
    // flagged, both visually (`aria-invalid`) and in an announced message.
    await expect(f.name).toHaveAttribute("aria-invalid", "true");
    await expect(f.email).toHaveAttribute("aria-invalid", "true");
    await expect(f.phone).not.toHaveAttribute("aria-invalid", "true");
    await expect(errors(f.form)).toHaveCount(2);

    // Nothing was sent, and the button is still armed rather than stuck in "sending".
    assertNoRequest();
    await expect(f.submit).toBeEnabled();
  });

  test("a malformed email is rejected without a round trip", async ({ page }) => {
    const assertNoRequest = await forbidContactApi(page);
    await gotoHydrated(page, "/#estimare");

    const f = fields(page);
    await f.name.fill("Ion Popescu");
    await f.email.fill("not-an-email");
    await f.submit.click();

    await expect(f.email).toHaveAttribute("aria-invalid", "true");
    await expect(f.name).not.toHaveAttribute("aria-invalid", "true");
    assertNoRequest();
  });

  test("a validation message clears as soon as the field is corrected", async ({ page }) => {
    await forbidContactApi(page);
    await gotoHydrated(page, "/#estimare");

    const f = fields(page);
    await f.submit.click();
    await expect(errors(f.form)).toHaveCount(2);

    await f.name.fill("Ion Popescu");
    await expect(errors(f.form)).toHaveCount(1);
    await expect(f.name).not.toHaveAttribute("aria-invalid", "true");
  });

  test("a valid form submits the expected payload @smoke", async ({ page }) => {
    const calls = await stubContactApi(page);
    await gotoHydrated(page, "/#estimare");

    const f = fields(page);
    await f.name.fill("Ion Popescu");
    await f.email.fill("ion.popescu@example.com");
    await f.phone.fill("+373 60 000 000");
    await f.details.fill("Vrem un magazin online cu plăți online.");

    await f.submit.click();

    // The success state is announced, not just styled.
    await expect(sentNote(f.form)).toBeVisible();
    await expect(f.submit).toBeDisabled();
    await expect(errors(f.form)).toHaveCount(0);

    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call.method).toBe("POST");
    expect(new URL(call.url).pathname).toBe("/api/contact");

    const body = call.body as Record<string, unknown>;
    expect(body.name).toBe("Ion Popescu");
    expect(body.email).toBe("ion.popescu@example.com");
    expect(body.phone).toBe("+373 60 000 000");
    // The estimator folds the visitor's picks into `message` and sends the chosen project
    // type and its price alongside — that is what makes the lead actionable.
    expect(String(body.message)).toContain("Vrem un magazin online cu plăți online.");
    expect(typeof body.project).toBe("string");
    expect(String(body.project).length).toBeGreaterThan(0);
    expect(String(body.estimate)).toMatch(/€/);
  });

  test("the request is sent only once, however hard the button is pressed", async ({ page }) => {
    const calls = await stubContactApi(page);
    await gotoHydrated(page, "/#estimare");

    const f = fields(page);
    await f.name.fill("Ion Popescu");
    await f.email.fill("ion.popescu@example.com");

    await f.submit.click();
    await expect(f.submit).toBeDisabled();
    // A disabled button cannot be clicked again — assert the guard held.
    await page.waitForTimeout(300);
    expect(calls).toHaveLength(1);
  });

  test("a rejected request keeps the form usable and says so", async ({ page }) => {
    await page.route("**/api/contact", (route) =>
      route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Too Many Requests" }),
      }),
    );
    await gotoHydrated(page, "/#estimare");

    const f = fields(page);
    await f.name.fill("Ion Popescu");
    await f.email.fill("ion.popescu@example.com");
    await f.submit.click();

    await expect(errors(f.form).last()).toBeVisible();
    await expect(sentNote(f.form)).toHaveCount(0);
    await expect(f.submit).toBeEnabled();
  });
});
