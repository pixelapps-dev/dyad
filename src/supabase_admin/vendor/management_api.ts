/**
 * Clean-room Supabase Management API client.
 *
 * Replaces `@dyad-sh/supabase-management-js` with just the surface
 * the fork actually consumes:
 *
 *   - `getProjects()`                 GET  /v1/projects
 *   - `getProjectApiKeys(ref)`        GET  /v1/projects/{ref}/api-keys
 *   - `getSecrets(ref)`               GET  /v1/projects/{ref}/secrets
 *   - `runQuery(ref, query)`          POST /v1/projects/{ref}/database/query
 *   - `deleteFunction(ref, slug)`     DELETE /v1/projects/{ref}/functions/{slug}
 *
 * Plus the two error utilities callers depended on:
 *   - `SupabaseManagementAPIError`
 *   - `isSupabaseError(err)`
 *
 * Response types are intentionally loose (`unknown[]`, `Record<...>`,
 * etc.) — the consumers in this fork only care about a small subset
 * of fields and Supabase's OpenAPI schema is large and fast-moving.
 * Tighten them if/when a consumer needs more.
 */

export interface SupabaseManagementAPIOptions {
  accessToken: string;
  /** Override the API host for testing. Defaults to Supabase's public API. */
  baseUrl?: string;
}

export class SupabaseManagementAPIError extends Error {
  readonly response: Response;

  constructor(message: string, response: Response) {
    super(message);
    this.name = "SupabaseManagementAPIError";
    this.response = response;
  }
}

export function isSupabaseError(
  error: unknown,
): error is SupabaseManagementAPIError {
  return error instanceof SupabaseManagementAPIError;
}

export interface SupabaseProjectSummary {
  id: string;
  organization_id: string;
  name: string;
  region: string;
  created_at: string;
  status: string;
  [key: string]: unknown;
}

export interface SupabaseProjectApiKey {
  name: string;
  api_key: string;
  [key: string]: unknown;
}

export interface SupabaseProjectSecret {
  name: string;
  value: string;
  [key: string]: unknown;
}

export class SupabaseManagementAPI {
  private readonly accessToken: string;
  private readonly baseUrl: string;

  constructor(options: SupabaseManagementAPIOptions) {
    if (!options?.accessToken) {
      throw new Error("SupabaseManagementAPI: accessToken is required");
    }
    this.accessToken = options.accessToken;
    this.baseUrl = (options.baseUrl ?? "https://api.supabase.com").replace(
      /\/+$/,
      "",
    );
  }

  private async request(
    method: "GET" | "POST" | "DELETE",
    pathname: string,
    body?: unknown,
  ): Promise<Response> {
    const url = `${this.baseUrl}${pathname}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: "application/json",
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    const response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      let message = `${method} ${pathname} -> HTTP ${response.status}`;
      try {
        const text = await response.clone().text();
        if (text) message += `: ${text.slice(0, 500)}`;
      } catch {
        // ignore — keep the base message
      }
      throw new SupabaseManagementAPIError(message, response);
    }
    return response;
  }

  private async getJson<T>(pathname: string): Promise<T> {
    const response = await this.request("GET", pathname);
    return (await response.json()) as T;
  }

  /** GET /v1/projects */
  async getProjects(): Promise<SupabaseProjectSummary[]> {
    return this.getJson<SupabaseProjectSummary[]>("/v1/projects");
  }

  /** GET /v1/projects/{ref}/api-keys */
  async getProjectApiKeys(ref: string): Promise<SupabaseProjectApiKey[]> {
    return this.getJson<SupabaseProjectApiKey[]>(
      `/v1/projects/${encodeURIComponent(ref)}/api-keys`,
    );
  }

  /** GET /v1/projects/{ref}/secrets */
  async getSecrets(ref: string): Promise<SupabaseProjectSecret[]> {
    return this.getJson<SupabaseProjectSecret[]>(
      `/v1/projects/${encodeURIComponent(ref)}/secrets`,
    );
  }

  /**
   * POST /v1/projects/{ref}/database/query
   *
   * The Supabase Management API returns the raw query rows as JSON.
   * Shape varies per query so we type it loosely; the callers pick
   * the fields they need.
   */
  async runQuery(ref: string, query: string): Promise<unknown[]> {
    const response = await this.request(
      "POST",
      `/v1/projects/${encodeURIComponent(ref)}/database/query`,
      { query },
    );
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  /** DELETE /v1/projects/{ref}/functions/{slug} */
  async deleteFunction(ref: string, slug: string): Promise<void> {
    await this.request(
      "DELETE",
      `/v1/projects/${encodeURIComponent(ref)}/functions/${encodeURIComponent(slug)}`,
    );
  }
}
