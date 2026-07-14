import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SiteData } from "@/lib/siteContent";
import type { ContactSubmissionRecord } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  submitContact: vi.fn(),
  isNetworkError: vi.fn(() => false),
  isUnauthorized: vi.fn(() => false),
  fetchContent: vi.fn(),
  saveContent: vi.fn(),
  login: vi.fn(),
  fetchMe: vi.fn(),
  fetchSubmissions: vi.fn(),
  getToken: vi.fn(() => "tok"),
  setToken: vi.fn(),
  clearToken: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import * as api from "@/lib/api";
import AdminPage from "@/app/admin-tbs-digital/page";

const sampleContent: SiteData = {
  stats: [{ id: "s1", value: "50+", label: "PROIECTE" }],
  services: [
    { id: "landing", name: "Landing page", desc: "O pagina.", price: "€500" },
  ],
  team: [{ id: "t1", name: "Ion", role: "Dev", bio: "Bio." }],
  partners: [{ id: "acme", name: "ACME", logo: "", url: "" }],
  contacts: [{ id: "c1", type: "email", value: "a@b.com" }],
};

const submissions: ContactSubmissionRecord[] = [
  {
    id: "r1",
    name: "Ana Pop",
    email: "ana@example.ro",
    message: "Salut, vreau un site.",
    created_at: "2026-07-01T10:00:00Z",
  },
  {
    id: "r2",
    name: "Bob Ion",
    email: "bob@example.ro",
    message: "Am nevoie de o aplicație mobilă.",
    created_at: "2026-07-02T10:00:00Z",
  },
];

async function renderAuthedEditor() {
  render(<AdminPage />);
  // Wait until the authenticated editor is mounted.
  await screen.findByText("Editează conținutul site-ului");
}

beforeEach(() => {
  vi.mocked(api.getToken).mockReturnValue("tok");
  vi.mocked(api.isNetworkError).mockReturnValue(false);
  vi.mocked(api.isUnauthorized).mockReturnValue(false);
  vi.mocked(api.fetchMe).mockResolvedValue({ username: "admin" });
  vi.mocked(api.fetchContent).mockResolvedValue(sampleContent);
  vi.mocked(api.fetchSubmissions).mockResolvedValue(submissions);
});

describe("Admin editor — tabs & submissions", () => {
  it("renders the tab bar with Cereri as the default (first) tab", async () => {
    await renderAuthedEditor();

    const nav = screen.getByRole("navigation", { name: "Secțiuni admin" });
    expect(nav).toBeInTheDocument();
    for (const label of [
      /Cereri/,
      "Servicii & prețuri",
      "Statistici",
      "Echipă",
      "Parteneri",
      "Contact",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }

    // Cereri is the active/default tab.
    const cereri = screen.getByRole("button", { name: /Cereri/ });
    expect(cereri).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("CERERI PRIMITE")).toBeInTheDocument();
  });

  it("lists the submissions with a count badge on the Cereri tab", async () => {
    await renderAuthedEditor();

    // Both submissions are shown (name, email, message).
    expect(await screen.findByText("Ana Pop")).toBeInTheDocument();
    expect(screen.getByText("ana@example.ro")).toBeInTheDocument();
    expect(screen.getByText("Salut, vreau un site.")).toBeInTheDocument();
    expect(screen.getByText("Bob Ion")).toBeInTheDocument();
    expect(
      screen.getByText("Am nevoie de o aplicație mobilă."),
    ).toBeInTheDocument();

    // Count badge (2) rides on the Cereri tab button.
    expect(screen.getByRole("button", { name: /Cereri/ })).toHaveTextContent("2");
  });

  it('shows "Nicio cerere încă." when there are no submissions', async () => {
    vi.mocked(api.fetchSubmissions).mockResolvedValue([]);
    await renderAuthedEditor();

    expect(await screen.findByText("Nicio cerere încă.")).toBeInTheDocument();
  });

  it("switches to the Servicii tab, hiding Cereri and showing editor fields", async () => {
    const user = userEvent.setup();
    await renderAuthedEditor();
    // Ensure submissions loaded first.
    await screen.findByText("Ana Pop");

    await user.click(
      screen.getByRole("button", { name: "Servicii & prețuri" }),
    );

    // Cereri content is gone; the services editor is now visible.
    expect(screen.queryByText("CERERI PRIMITE")).not.toBeInTheDocument();
    expect(screen.getByText("SERVICII & PREȚURI")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Landing page")).toBeInTheDocument();
  });

  it("disables Save when an admin field holds invalid (dangerous) input", async () => {
    const user = userEvent.setup();
    await renderAuthedEditor();
    await screen.findByText("Ana Pop");

    await user.click(
      screen.getByRole("button", { name: "Servicii & prețuri" }),
    );

    const saveBtn = screen.getByRole("button", {
      name: "Salvează modificările",
    });
    expect(saveBtn).toBeEnabled();

    // Inject markup into the service name → validation fails → Save disabled.
    await user.type(screen.getByDisplayValue("Landing page"), "<b>x</b>");

    await waitFor(() => expect(saveBtn).toBeDisabled());
    expect(
      screen.getByText("Corectează câmpurile marcate înainte de salvare."),
    ).toBeInTheDocument();
  });
});
