/*
 * Typed client for the TBS Digital FastAPI backend.
 *
 * Base URL comes from `NEXT_PUBLIC_API_URL` (inlined at build time). All calls
 * are made from the browser at runtime; every helper throws an `ApiError` on a
 * non-2xx response or a network failure so callers can fall back gracefully.
 *
 * The API contract is fixed and documented in `backend/README.md` /
 * `backend/app/schemas.py`. `SiteContent` mirrors `SiteData` field-for-field.
 */

import type { SiteData } from "./siteContent";

/** Base URL of the backend. Must be a static reference so Next.js can inline it. */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** localStorage key holding the admin bearer token. */
const TOKEN_KEY = "tbs_admin_token";

/** Error carrying the HTTP status (`0` means the request never reached the API). */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** True when the request could not reach the backend at all (offline / CORS / down). */
export function isNetworkError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 0;
}

/** True when the backend rejected the token (expired / invalid). */
export function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

// --- token storage (browser only) -----------------------------------------
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage unavailable — ignore */
  }
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

// --- request payloads / responses ------------------------------------------
export type ContactSubmission = {
  name: string;
  email: string;
  phone?: string;
  message?: string;
  project?: string;
  estimate?: string;
};

/** A stored submission as returned by `GET /api/admin/submissions`. */
export type ContactSubmissionRecord = ContactSubmission & {
  id: string;
  created_at: string; // ISO 8601 timestamp
};

export type LoginResponse = { access_token: string; token_type: string };
export type AdminInfo = { username: string };
export type UploadResponse = { url: string };

/**
 * Resolve a stored image reference to a URL the browser can load.
 *
 * Partner logos come from two places. Bundled assets (`/partners/crowe.png`) are
 * served by Next itself, so they are already correct. Uploaded logos are served by
 * the backend under `/api/uploads/…` and are stored site-relative on purpose — in
 * production nginx proxies `/api/` to the backend, so the same path works from the
 * site's own origin. In development the two run on different ports, so the API base
 * has to be prepended. An absolute URL is returned untouched.
 */
export function mediaUrl(path: string): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/api/")) return `${API_URL}${path}`;
  return path;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
};

/** Extract a human-readable message from a FastAPI error body (`{detail: ...}`). */
function messageFromDetail(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string };
    if (first?.msg) return first.msg;
  }
  return fallback;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // DNS failure, connection refused, CORS, offline, etc.
    throw new ApiError(0, "Nu s-a putut contacta serverul.");
  }

  if (!res.ok) {
    // TODO(i18n): "Eroare {status}" is a rare last-resort fallback (server `detail` is
    // used when present). Localize if these ever surface to users in another language.
    let message = res.statusText || `Eroare ${res.status}`;
    try {
      const data = (await res.json()) as { detail?: unknown };
      message = messageFromDetail(data?.detail, message);
    } catch {
      /* response had no JSON body — keep the status text */
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// --- endpoints -------------------------------------------------------------
/** GET /api/content — public. Returns the whole editable content document. */
export function fetchContent(): Promise<SiteData> {
  return request<SiteData>("/api/content");
}

/** PUT /api/content — admin. Replaces the whole content document. */
export function saveContent(data: SiteData, token: string): Promise<void> {
  return request<void>("/api/content", { method: "PUT", body: data, token });
}

/**
 * POST /api/admin/uploads — admin. Stores a partner logo and returns its path
 * (`/api/uploads/<uuid>.png`), ready to be saved as a partner's `logo`.
 *
 * `fetch` sets the multipart `Content-Type` (with its boundary) from the FormData,
 * so this bypasses the JSON `request()` helper rather than fighting its headers.
 */
export async function uploadLogo(file: File, token: string): Promise<string> {
  const form = new FormData();
  form.append("file", file);

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/admin/uploads`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  } catch {
    throw new ApiError(0, "Nu s-a putut contacta serverul.");
  }

  if (!res.ok) {
    // TODO(i18n): "Eroare {status}" is a rare last-resort fallback (server `detail` is
    // used when present). Localize if these ever surface to users in another language.
    let message = res.statusText || `Eroare ${res.status}`;
    try {
      const data = (await res.json()) as { detail?: unknown };
      message = messageFromDetail(data?.detail, message);
    } catch {
      /* no JSON body — keep the status text */
    }
    throw new ApiError(res.status, message);
  }

  const data = (await res.json()) as UploadResponse;
  return data.url;
}

/** POST /api/contact — public. Stores a contact-form submission. */
export function submitContact(payload: ContactSubmission): Promise<void> {
  return request<void>("/api/contact", { method: "POST", body: payload });
}

/** POST /api/auth/login — public. Returns the bearer token on success. */
export async function login(username: string, password: string): Promise<string> {
  const res = await request<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: { username, password },
  });
  return res.access_token;
}

/** GET /api/auth/me — admin. Validates the token; throws on 401. */
export function fetchMe(token: string): Promise<AdminInfo> {
  return request<AdminInfo>("/api/auth/me", { token });
}

/**
 * GET /api/admin/submissions — admin. Returns contact submissions newest-first.
 * Sorted defensively here (by `created_at`/`id` desc) in case the API order ever
 * changes.
 */
export async function fetchSubmissions(
  token: string,
): Promise<ContactSubmissionRecord[]> {
  const rows = await request<ContactSubmissionRecord[]>(
    "/api/admin/submissions",
    { token },
  );
  return [...rows].sort((a, b) => {
    const byDate = (b.created_at ?? "").localeCompare(a.created_at ?? "");
    return byDate !== 0 ? byDate : (b.id ?? "").localeCompare(a.id ?? "");
  });
}
