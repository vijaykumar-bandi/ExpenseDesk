/**
 * The one way the SPA talks to the API.
 *
 * - Sends the session cookie and the CSRF header (X-XSRF-TOKEN from the
 *   XSRF-TOKEN cookie).
 * - Turns a 401 into a redirect to /sign-in.
 * - Throws ApiError { status, message, errors } for every non-2xx answer.
 */

export interface ApiErrorBody {
  message?: string;
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  status: number;
  errors: Record<string, string[]>;

  constructor(status: number, message: string, errors: Record<string, string[]> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

export type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

/** The router registers the handler that clears the auth store and pushes /sign-in. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function csrfHeaders(): Record<string, string> {
  const token = readCookie('XSRF-TOKEN');
  return token ? { 'X-XSRF-TOKEN': token } : {};
}

async function request<T>(method: string, path: string, body?: unknown, isForm = false): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...csrfHeaders(),
  };

  let payload: BodyInit | undefined;
  if (body !== undefined) {
    if (isForm) {
      payload = body as FormData;
    } else {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
  }

  const response = await fetch(path, {
    method,
    headers,
    body: payload,
    credentials: 'same-origin',
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const errorBody = (parsed ?? {}) as ApiErrorBody;
    const message = errorBody.message || 'Something went wrong. Try again.';

    if (response.status === 401) {
      unauthorizedHandler?.();
    }

    throw new ApiError(response.status, message, errorBody.errors ?? {});
  }

  return parsed as T;
}

export const api = {
  get<T>(path: string): Promise<T> {
    return request<T>('GET', path);
  },
  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('POST', path, body ?? {});
  },
  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('PUT', path, body ?? {});
  },
  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('PATCH', path, body ?? {});
  },
  del<T>(path: string): Promise<T> {
    return request<T>('DELETE', path);
  },
  upload<T>(path: string, form: FormData): Promise<T> {
    return request<T>('POST', path, form, true);
  },
};

export default api;
