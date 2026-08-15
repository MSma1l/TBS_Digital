import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SiteData } from "@/lib/siteContent";
import { ApiError, type ContactSubmissionRecord } from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ApiError: actual.ApiError,
    submitContact: vi.fn(),
    isNetworkError: vi.fn(
      (err: unknown) => err instanceof actual.ApiError && err.status === 0,
    ),
    isUnauthorized: vi.fn(
      (err: unknown) => err instanceof actual.ApiError && err.status === 401,
    ),
    fetchContent: vi.fn(),
    saveContent: vi.fn(),
    login: vi.fn(),
    fetchMe: vi.fn(),
    fetchSubmissions: vi.fn(),
    deleteSubmission: vi.fn(),
    getToken: vi.fn(() => "tok"),
    setToken: vi.fn(),
    clearToken: vi.fn(),
  };
});

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
  team: [
    {
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
    },
  ],
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
  await screen.findByText("Editează conținutul site-ului");
}

beforeEach(() => {
  vi.mocked(api.getToken).mockReturnValue("tok");
  vi.mocked(api.isNetworkError).mockImplementation(
    (err: unknown) => err instanceof ApiError && err.status === 0,
  );
  vi.mocked(api.isUnauthorized).mockImplementation(
    (err: unknown) => err instanceof ApiError && err.status === 401,
  );
  vi.mocked(api.fetchMe).mockResolvedValue({ username: "admin" });
  vi.mocked(api.fetchContent).mockResolvedValue(sampleContent);
  vi.mocked(api.fetchSubmissions).mockResolvedValue(submissions);
  vi.mocked(api.deleteSubmission).mockReset();
});

describe("Admin editor — deleting a submission (Cereri tab)", () => {
  it("requires a second click: one click alone does not delete", async () => {
    const user = userEvent.setup();
    await renderAuthedEditor();
    await screen.findByText("Ana Pop");

    await user.click(
      screen.getByRole("button", { name: "Șterge cererea de la Ana Pop" }),
    );

    // The row is still there and the API was never called.
    expect(screen.getByText("Ana Pop")).toBeInTheDocument();
    expect(api.deleteSubmission).not.toHaveBeenCalled();

    // The confirm step is now showing.
    expect(screen.getByText("Sigur?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmă" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anulează" })).toBeInTheDocument();
  });

  it("Anulează backs out of the confirm step without deleting", async () => {
    const user = userEvent.setup();
    await renderAuthedEditor();
    await screen.findByText("Ana Pop");

    await user.click(
      screen.getByRole("button", { name: "Șterge cererea de la Ana Pop" }),
    );
    await user.click(screen.getByRole("button", { name: "Anulează" }));

    expect(screen.queryByText("Sigur?")).not.toBeInTheDocument();
    expect(screen.getByText("Ana Pop")).toBeInTheDocument();
    expect(api.deleteSubmission).not.toHaveBeenCalled();
  });

  it("Confirmă deletes: the row disappears and the tab badge count drops", async () => {
    vi.mocked(api.deleteSubmission).mockResolvedValue(undefined);
    const user = userEvent.setup();
    await renderAuthedEditor();
    await screen.findByText("Ana Pop");

    expect(screen.getByRole("button", { name: /Cereri/ })).toHaveTextContent("2");

    await user.click(
      screen.getByRole("button", { name: "Șterge cererea de la Ana Pop" }),
    );
    await user.click(screen.getByRole("button", { name: "Confirmă" }));

    await waitFor(() =>
      expect(screen.queryByText("Ana Pop")).not.toBeInTheDocument(),
    );
    expect(api.deleteSubmission).toHaveBeenCalledWith("r1", "tok");

    // The other submission is unaffected; badge count went from 2 to 1.
    expect(screen.getByText("Bob Ion")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cereri/ })).toHaveTextContent("1");
  });

  it("shows an error and keeps the row when the delete fails (404)", async () => {
    vi.mocked(api.deleteSubmission).mockRejectedValue(
      new ApiError(404, "Not found"),
    );
    const user = userEvent.setup();
    await renderAuthedEditor();
    await screen.findByText("Ana Pop");

    await user.click(
      screen.getByRole("button", { name: "Șterge cererea de la Ana Pop" }),
    );
    await user.click(screen.getByRole("button", { name: "Confirmă" }));

    expect(
      await screen.findByText("Cererea nu mai există — a fost ștearsă deja."),
    ).toBeInTheDocument();
    // Row stays on screen; badge count is unchanged.
    expect(screen.getByText("Ana Pop")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cereri/ })).toHaveTextContent("2");
  });

  it("shows a network-error message and keeps the row on a failed fetch", async () => {
    vi.mocked(api.deleteSubmission).mockRejectedValue(new ApiError(0, "offline"));
    const user = userEvent.setup();
    await renderAuthedEditor();
    await screen.findByText("Ana Pop");

    await user.click(
      screen.getByRole("button", { name: "Șterge cererea de la Ana Pop" }),
    );
    await user.click(screen.getByRole("button", { name: "Confirmă" }));

    expect(
      await screen.findByText("Serverul nu răspunde. Încearcă din nou."),
    ).toBeInTheDocument();
    expect(screen.getByText("Ana Pop")).toBeInTheDocument();
  });
});
