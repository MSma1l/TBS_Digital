import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ApiError,
  isNetworkError,
  isUnauthorized,
  getToken,
  setToken,
  clearToken,
  fetchContent,
  saveContent,
  submitContact,
  login,
  fetchMe,
  fetchSubmissions,
  type ContactSubmission,
  type ContactSubmissionRecord,
} from "@/lib/api";
import { defaultSiteData, type SiteData } from "@/lib/siteContent";

// The client reads its base URL from NEXT_PUBLIC_API_URL at import time, falling
// back to this default. Tests assert paths against the same value.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type FetchArgs = { url: string; init: RequestInit };

/** Build a minimal Response-like object matching what `request()` consumes. */
function makeResponse(opts: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  json?: () => Promise<unknown>;
}): Response {
  const status = opts.status ?? 200;
  return {
    ok: opts.ok ?? (status >= 200 && status < 300),
    status,
    statusText: opts.statusText ?? "",
    json: opts.json ?? (async () => ({})),
  } as unknown as Response;
}

/** Install a fetch mock that resolves with `response` and captures the call. */
function stubFetch(response: Response): { calls: FetchArgs[] } {
  const calls: FetchArgs[] = [];
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return response;
  });
  vi.stubGlobal("fetch", fn);
  return { calls };
}

/** Parse the captured headers into a plain record (they are always a plain object here). */
function headersOf(init: RequestInit): Record<string, string> {
  return (init.headers ?? {}) as Record<string, string>;
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("token helpers", () => {
  it("round-trips a token through localStorage", () => {
    expect(getToken()).toBeNull();
    setToken("abc123");
    expect(window.localStorage.getItem("tbs_admin_token")).toBe("abc123");
    expect(getToken()).toBe("abc123");
    clearToken();
    expect(getToken()).toBeNull();
  });

  it("swallows errors when localStorage.setItem throws", () => {
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });
    expect(() => setToken("x")).not.toThrow();
    spy.mockRestore();
  });

  it("returns null when getItem throws", () => {
    const spy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    expect(getToken()).toBeNull();
    spy.mockRestore();
  });

  it("swallows errors when removeItem throws", () => {
    const spy = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    expect(() => clearToken()).not.toThrow();
    spy.mockRestore();
  });
});

describe("error guards", () => {
  it("isNetworkError only true for ApiError status 0", () => {
    expect(isNetworkError(new ApiError(0, "x"))).toBe(true);
    expect(isNetworkError(new ApiError(500, "x"))).toBe(false);
    expect(isNetworkError(new Error("x"))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });

  it("isUnauthorized only true for ApiError status 401", () => {
    expect(isUnauthorized(new ApiError(401, "x"))).toBe(true);
    expect(isUnauthorized(new ApiError(403, "x"))).toBe(false);
    expect(isUnauthorized(new Error("x"))).toBe(false);
  });
});

describe("fetchContent", () => {
  it("GETs /api/content with no auth header or body", async () => {
    const { calls } = stubFetch(
      makeResponse({ json: async () => defaultSiteData }),
    );
    const data = await fetchContent();
    expect(data).toEqual(defaultSiteData);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${API_BASE}/api/content`);
    expect(calls[0].init.method).toBe("GET");
    expect(calls[0].init.body).toBeUndefined();
    const headers = headersOf(calls[0].init);
    expect(headers.Authorization).toBeUndefined();
    expect(headers["Content-Type"]).toBeUndefined();
  });
});

describe("saveContent", () => {
  it("PUTs /api/content with bearer + JSON body", async () => {
    const { calls } = stubFetch(makeResponse({ status: 204 }));
    const body: SiteData = defaultSiteData;
    const result = await saveContent(body, "tok-1");
    expect(result).toBeUndefined();
    expect(calls[0].url).toBe(`${API_BASE}/api/content`);
    expect(calls[0].init.method).toBe("PUT");
    expect(calls[0].init.body).toBe(JSON.stringify(body));
    const headers = headersOf(calls[0].init);
    expect(headers.Authorization).toBe("Bearer tok-1");
    expect(headers["Content-Type"]).toBe("application/json");
  });
});

describe("submitContact", () => {
  it("POSTs /api/contact with JSON body and no auth", async () => {
    const { calls } = stubFetch(makeResponse({ status: 204 }));
    const payload: ContactSubmission = {
      name: "Ana",
      email: "ana@example.com",
    };
    await submitContact(payload);
    expect(calls[0].url).toBe(`${API_BASE}/api/contact`);
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.body).toBe(JSON.stringify(payload));
    const headers = headersOf(calls[0].init);
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers.Authorization).toBeUndefined();
  });
});

describe("login", () => {
  it("POSTs credentials and returns the access_token", async () => {
    const { calls } = stubFetch(
      makeResponse({
        json: async () => ({ access_token: "jwt-xyz", token_type: "bearer" }),
      }),
    );
    const token = await login("admin", "secret");
    expect(token).toBe("jwt-xyz");
    expect(calls[0].url).toBe(`${API_BASE}/api/auth/login`);
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.body).toBe(
      JSON.stringify({ username: "admin", password: "secret" }),
    );
    expect(headersOf(calls[0].init).Authorization).toBeUndefined();
  });
});

describe("fetchMe", () => {
  it("GETs /api/auth/me with the bearer token", async () => {
    const { calls } = stubFetch(
      makeResponse({ json: async () => ({ username: "admin" }) }),
    );
    const info = await fetchMe("tok-9");
    expect(info).toEqual({ username: "admin" });
    expect(calls[0].url).toBe(`${API_BASE}/api/auth/me`);
    expect(calls[0].init.method).toBe("GET");
    expect(headersOf(calls[0].init).Authorization).toBe("Bearer tok-9");
  });
});

describe("fetchSubmissions", () => {
  it("sorts rows newest-first by created_at desc", async () => {
    const rows: ContactSubmissionRecord[] = [
      {
        id: "a",
        created_at: "2026-01-01T10:00:00Z",
        name: "Old",
        email: "o@x.ro",
      },
      {
        id: "b",
        created_at: "2026-03-01T10:00:00Z",
        name: "New",
        email: "n@x.ro",
      },
      {
        id: "c",
        created_at: "2026-02-01T10:00:00Z",
        name: "Mid",
        email: "m@x.ro",
      },
    ];
    stubFetch(makeResponse({ json: async () => rows }));
    const sorted = await fetchSubmissions("tok");
    expect(sorted.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("breaks created_at ties by id desc", async () => {
    const ts = "2026-05-05T00:00:00Z";
    const rows: ContactSubmissionRecord[] = [
      { id: "id-1", created_at: ts, name: "A", email: "a@x.ro" },
      { id: "id-3", created_at: ts, name: "C", email: "c@x.ro" },
      { id: "id-2", created_at: ts, name: "B", email: "b@x.ro" },
    ];
    stubFetch(makeResponse({ json: async () => rows }));
    const sorted = await fetchSubmissions("tok");
    expect(sorted.map((r) => r.id)).toEqual(["id-3", "id-2", "id-1"]);
  });

  it("sends the bearer token and does not mutate the source array", async () => {
    const rows: ContactSubmissionRecord[] = [
      { id: "1", created_at: "2026-01-01T00:00:00Z", name: "X", email: "x@x.ro" },
      { id: "2", created_at: "2026-02-01T00:00:00Z", name: "Y", email: "y@x.ro" },
    ];
    const { calls } = stubFetch(makeResponse({ json: async () => rows }));
    await fetchSubmissions("tok-sub");
    expect(headersOf(calls[0].init).Authorization).toBe("Bearer tok-sub");
    // Original order preserved (sort operates on a copy).
    expect(rows.map((r) => r.id)).toEqual(["1", "2"]);
  });
});

describe("error handling", () => {
  it("throws ApiError with status + {detail} string message on non-2xx", async () => {
    stubFetch(
      makeResponse({
        ok: false,
        status: 400,
        json: async () => ({ detail: "Cerere invalidă." }),
      }),
    );
    await expect(fetchContent()).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      message: "Cerere invalidă.",
    });
  });

  it("uses detail[0].msg for a FastAPI validation array detail", async () => {
    stubFetch(
      makeResponse({
        ok: false,
        status: 422,
        json: async () => ({
          detail: [
            { msg: "field required", loc: ["body", "name"] },
            { msg: "second error" },
          ],
        }),
      }),
    );
    await expect(fetchContent()).rejects.toMatchObject({
      status: 422,
      message: "field required",
    });
  });

  it("falls back to statusText when the error body has no JSON", async () => {
    stubFetch(
      makeResponse({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => {
          throw new Error("not json");
        },
      }),
    );
    await expect(fetchContent()).rejects.toMatchObject({
      status: 500,
      message: "Internal Server Error",
    });
  });

  it("maps a rejected fetch (network failure) to ApiError status 0", async () => {
    const fn = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    vi.stubGlobal("fetch", fn);
    const err = await fetchContent().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(isNetworkError(err)).toBe(true);
    expect((err as ApiError).message).toBe("Nu s-a putut contacta serverul.");
  });

  it("throws ApiError 401 (unauthorized) that isUnauthorized recognizes", async () => {
    stubFetch(
      makeResponse({
        ok: false,
        status: 401,
        json: async () => ({ detail: "Token invalid." }),
      }),
    );
    const err = await fetchMe("bad").catch((e: unknown) => e);
    expect(isUnauthorized(err)).toBe(true);
    expect((err as ApiError).status).toBe(401);
  });

  it("resolves 204 responses to undefined without parsing a body", async () => {
    const jsonSpy = vi.fn(async () => ({ should: "not be called" }));
    stubFetch(makeResponse({ status: 204, json: jsonSpy }));
    const result = await saveContent(defaultSiteData, "t");
    expect(result).toBeUndefined();
    expect(jsonSpy).not.toHaveBeenCalled();
  });
});
