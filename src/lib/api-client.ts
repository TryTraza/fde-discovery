/**
 * Typed HTTP client used by all client-side services.
 *
 * Centralises:
 *  - JSON encoding/decoding
 *  - Query-string assembly (skipping null/undefined)
 *  - Error mapping (401 → UnauthorizedError, 422 NO_API_KEY → ApiKeyMissingError, else ApiError)
 *
 * Server-side route handlers do NOT use this — they continue to call Drizzle
 * queries directly and return NextResponse via handleAPIError().
 */

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export class UnauthorizedError extends ApiError {
  constructor(body: unknown) {
    super('Unauthorized', 401, body);
    this.name = 'UnauthorizedError';
  }
}

export class ApiKeyMissingError extends ApiError {
  constructor(body: unknown) {
    super('NO_API_KEY', 422, body);
    this.name = 'ApiKeyMissingError';
  }
}

type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

function buildUrl(path: string, params?: QueryParams): string {
  if (!params) return path;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  if (!qs) return path;
  return path.includes('?') ? `${path}&${qs}` : `${path}?${qs}`;
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (res.ok) {
    const body = await parseBody(res);
    return body as T;
  }

  const body = await parseBody(res);
  const errorMessage =
    (body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string'
      ? (body as { error: string }).error
      : undefined) || res.statusText || `HTTP ${res.status}`;

  if (res.status === 401) throw new UnauthorizedError(body);
  if (res.status === 422 && errorMessage === 'NO_API_KEY') {
    throw new ApiKeyMissingError(body);
  }
  throw new ApiError(errorMessage, res.status, body);
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown
): Promise<T> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(path, init);
  return handle<T>(res);
}

export const apiClient = {
  get<T>(path: string, params?: QueryParams): Promise<T> {
    return request<T>('GET', buildUrl(path, params));
  },
  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('POST', path, body);
  },
  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('PATCH', path, body);
  },
  delete<T = unknown>(path: string): Promise<T> {
    return request<T>('DELETE', path);
  },
};
