import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SiteData } from "@/lib/siteContent";

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

// next/link → plain anchor (no router context needed in tests).
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
  stats: [{ id: "s1", value: "50+", label: { ro: "PROIECTE", ru: "", en: "" } }],
  services: [
    {
      id: "landing",
      name: { ro: "Landing page", ru: "", en: "" },
      desc: { ro: "O pagina.", ru: "", en: "" },
      price: { ro: "€500", ru: "", en: "" },
    },
  ],
  team: [{
      id: "t1",
      name: "Ion",
      role: { ro: "Dev", ru: "", en: "" },
      bio: { ro: "Bio.", ru: "", en: "" },
      photo: "",
      website: "",
      linkedin: "",
      instagram: "",
      facebook: "",
      github: "",
    }],
  partners: [{ id: "acme", name: "ACME", logo: "", url: "", preview: "" }],
  projects: [
    {
      id: "proj-1",
      name: "BizCheck",
      tag: { ro: "PLATFORMĂ WEB", ru: "", en: "" },
      desc: { ro: "O platformă.", ru: "", en: "" },
      url: "https://bizcheck.md",
      appStore: "",
      playStore: "",
      images: [],
    },
  ],
  contacts: [{ id: "c1", type: "email", value: "a@b.com" }],
  socials: [{ id: "so-telegram", type: "telegram", url: "" }],
};

beforeEach(() => {
  vi.mocked(api.isNetworkError).mockReturnValue(false);
  vi.mocked(api.isUnauthorized).mockReturnValue(false);
  vi.mocked(api.fetchContent).mockResolvedValue(sampleContent);
  vi.mocked(api.fetchSubmissions).mockResolvedValue([]);
  vi.mocked(api.fetchMe).mockResolvedValue({ username: "admin" });
});

describe("Admin gate — login form", () => {
  it("renders the login form (not the editor) when there is no token", async () => {
    vi.mocked(api.getToken).mockReturnValue(null);
    render(<AdminPage />);

    expect(await screen.findByPlaceholderText("Utilizator")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Parolă")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Autentifică-te/ }),
    ).toBeInTheDocument();
    // The authenticated editor must NOT be present.
    expect(screen.queryByText(/PANOU DE ADMINISTRARE/)).not.toBeInTheDocument();
  });

  it("shows an error and stays on login when credentials are wrong (401)", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getToken).mockReturnValue(null);
    vi.mocked(api.login).mockRejectedValue(
      Object.assign(new Error("unauthorized"), { status: 401 }),
    );

    render(<AdminPage />);

    await user.type(
      await screen.findByPlaceholderText("Utilizator"),
      "admin",
    );
    await user.type(screen.getByPlaceholderText("Parolă"), "wrong-pass");
    await user.click(screen.getByRole("button", { name: /Autentifică-te/ }));

    expect(
      await screen.findByText("Utilizator sau parolă incorecte."),
    ).toBeInTheDocument();
    // Still on the login form.
    expect(screen.getByPlaceholderText("Utilizator")).toBeInTheDocument();
    expect(screen.queryByText(/PANOU DE ADMINISTRARE/)).not.toBeInTheDocument();
  });

  it("transitions to the authenticated editor on valid credentials", async () => {
    const user = userEvent.setup();
    // No token on the initial mount check, a real token afterwards.
    vi.mocked(api.getToken).mockReturnValueOnce(null).mockReturnValue("tok-123");
    vi.mocked(api.login).mockResolvedValue("tok-123");

    render(<AdminPage />);

    await user.type(
      await screen.findByPlaceholderText("Utilizator"),
      "admin",
    );
    await user.type(screen.getByPlaceholderText("Parolă"), "correct-pass");
    await user.click(screen.getByRole("button", { name: /Autentifică-te/ }));

    // The editor heading appears once authenticated.
    expect(
      await screen.findByText("Editează conținutul site-ului"),
    ).toBeInTheDocument();
    expect(api.setToken).toHaveBeenCalledWith("tok-123");
    // Login form is gone.
    expect(screen.queryByPlaceholderText("Utilizator")).not.toBeInTheDocument();
  });
});
