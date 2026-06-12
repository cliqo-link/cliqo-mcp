/**
 * Thin HTTP client for the cliqo.link REST API.
 * https://cliqo.link/llms.txt
 */

const DEFAULT_BASE_URL = "https://api.cliqo.link";

export interface Link {
  id: number;
  shortLink: string;
  url: string;
  name?: string;
  [key: string]: unknown;
}

export interface Credits {
  links: number;
}

export interface CreateLinkInput {
  url: string;
  name?: string;
  utmSource?: string;
  utmCampaign?: string;
}

export interface ListLinksOptions {
  /** Include revoked links (default: only active links). */
  includeRevoked?: boolean;
  /** Filter by exact tag name. */
  tag?: string;
}

/** Raised when the API returns a non-2xx status. Carries the HTTP status for context. */
export class CliqoApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "CliqoApiError";
  }
}

export class CliqoClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(apiKey: string, baseUrl: string = DEFAULT_BASE_URL) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      throw new CliqoApiError(res.status, await describeError(res));
    }

    // 204 No Content (e.g. DELETE) has no JSON body.
    if (res.status === 204) {
      return undefined as T;
    }
    return (await res.json()) as T;
  }

  createLink(input: CreateLinkInput): Promise<Link> {
    return this.request<Link>("POST", "/api/v1/links", input);
  }

  listLinks(options: ListLinksOptions = {}): Promise<Link[]> {
    const params = new URLSearchParams();
    // The API defaults to active links only; opt in to revoked ones explicitly.
    if (options.includeRevoked) {
      params.set("exists[deletedAt]", "true");
    }
    if (options.tag) {
      params.set("tags.name", options.tag);
    }
    const query = params.toString();
    return this.request<Link[]>("GET", `/api/v1/links${query ? `?${query}` : ""}`);
  }

  getLink(id: number): Promise<Link> {
    return this.request<Link>("GET", `/api/v1/links/${id}`);
  }

  deleteLink(id: number): Promise<void> {
    return this.request<void>("DELETE", `/api/v1/links/${id}`);
  }

  getCredits(): Promise<Credits> {
    return this.request<Credits>("GET", "/api/v1/credits");
  }
}

/** Turn an error response into a human-readable message, including API detail when present. */
async function describeError(res: Response): Promise<string> {
  const base = httpReason(res.status);
  let detail = "";
  try {
    const data = (await res.json()) as Record<string, unknown>;
    const msg = data.detail ?? data.message ?? data.title ?? data.error;
    if (typeof msg === "string" && msg.length > 0) {
      detail = `: ${msg}`;
    }
  } catch {
    // Non-JSON body — fall back to the status reason alone.
  }
  return `${base}${detail}`;
}

function httpReason(status: number): string {
  switch (status) {
    case 401:
      return "401 Unauthorized — check that CLIQO_API_KEY is valid";
    case 403:
      return "403 Forbidden — your API key is missing the required scope";
    case 404:
      return "404 Not Found — the link does not exist or is not owned by you";
    case 422:
      return "422 Unprocessable — validation failed or you are out of credits";
    default:
      return `HTTP ${status}`;
  }
}
