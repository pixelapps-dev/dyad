import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  SupabaseManagementAPI,
  SupabaseManagementAPIError,
  isSupabaseError,
} from "./management_api";

const ACCESS_TOKEN = "sbp_test_token";

describe("SupabaseManagementAPI", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetch(
    handler: (input: RequestInfo | URL, init?: RequestInit) => Response,
  ) {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (...args) => {
      return handler(args[0] as RequestInfo, args[1]);
    });
    return spy;
  }

  it("throws on construction without an access token", () => {
    expect(() => new SupabaseManagementAPI({ accessToken: "" })).toThrow(
      /accessToken is required/,
    );
  });

  it("sends Authorization: Bearer on every call", async () => {
    const spy = mockFetch((_url) => new Response(JSON.stringify([])));
    const api = new SupabaseManagementAPI({ accessToken: ACCESS_TOKEN });
    await api.getProjects();
    expect(spy).toHaveBeenCalledOnce();
    const init = spy.mock.calls[0][1]!;
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${ACCESS_TOKEN}`,
    );
  });

  it("encodes project refs in the path", async () => {
    const urls: string[] = [];
    mockFetch((url) => {
      urls.push(url.toString());
      return new Response(JSON.stringify([]));
    });
    const api = new SupabaseManagementAPI({ accessToken: ACCESS_TOKEN });
    await api.getProjectApiKeys("proj with space");
    await api.getSecrets("proj#unusual");
    expect(urls[0]).toBe(
      "https://api.supabase.com/v1/projects/proj%20with%20space/api-keys",
    );
    expect(urls[1]).toBe(
      "https://api.supabase.com/v1/projects/proj%23unusual/secrets",
    );
  });

  it("throws SupabaseManagementAPIError on non-2xx responses", async () => {
    mockFetch(
      () =>
        new Response("internal boom", {
          status: 500,
          statusText: "Internal Server Error",
        }),
    );
    const api = new SupabaseManagementAPI({ accessToken: ACCESS_TOKEN });
    const err = await api.getProjects().catch((e) => e);
    expect(err).toBeInstanceOf(SupabaseManagementAPIError);
    expect(isSupabaseError(err)).toBe(true);
    expect(err.message).toMatch(/HTTP 500/);
    expect(err.message).toMatch(/internal boom/);
  });

  it("posts { query } to /database/query and returns the rows", async () => {
    const spy = mockFetch(
      () => new Response(JSON.stringify([{ one: 1 }, { two: 2 }])),
    );
    const api = new SupabaseManagementAPI({ accessToken: ACCESS_TOKEN });
    const rows = await api.runQuery("proj", "select 1");
    expect(rows).toEqual([{ one: 1 }, { two: 2 }]);
    const [url, init] = spy.mock.calls[0];
    expect(url.toString()).toBe(
      "https://api.supabase.com/v1/projects/proj/database/query",
    );
    expect(init!.method).toBe("POST");
    expect(JSON.parse(init!.body as string)).toEqual({ query: "select 1" });
  });

  it("normalises non-array runQuery responses to []", async () => {
    mockFetch(() => new Response(JSON.stringify({ notAnArray: true })));
    const api = new SupabaseManagementAPI({ accessToken: ACCESS_TOKEN });
    const rows = await api.runQuery("proj", "select 1");
    expect(rows).toEqual([]);
  });

  it("deleteFunction issues DELETE with no body", async () => {
    const spy = mockFetch(() => new Response("", { status: 204 }));
    const api = new SupabaseManagementAPI({ accessToken: ACCESS_TOKEN });
    await api.deleteFunction("proj", "hello-world");
    const [url, init] = spy.mock.calls[0];
    expect(url.toString()).toBe(
      "https://api.supabase.com/v1/projects/proj/functions/hello-world",
    );
    expect(init!.method).toBe("DELETE");
    expect(init!.body).toBeUndefined();
  });

  it("accepts a custom baseUrl and trims trailing slashes", async () => {
    const spy = mockFetch(() => new Response(JSON.stringify([])));
    const api = new SupabaseManagementAPI({
      accessToken: ACCESS_TOKEN,
      baseUrl: "https://mirror.example.com//",
    });
    await api.getProjects();
    expect(spy.mock.calls[0][0].toString()).toBe(
      "https://mirror.example.com/v1/projects",
    );
  });

  it("isSupabaseError returns false for unrelated errors", () => {
    expect(isSupabaseError(new Error("nope"))).toBe(false);
    expect(isSupabaseError("string")).toBe(false);
    expect(isSupabaseError(null)).toBe(false);
    expect(isSupabaseError(undefined)).toBe(false);
  });
});
