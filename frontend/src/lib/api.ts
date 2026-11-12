const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000/api/v1";

const ACCESS_KEY = "nattyrex.access";
const REFRESH_KEY = "nattyrex.refresh";

export const tokenStore = {
  access: () => localStorage.getItem(ACCESS_KEY),
  refresh: () => localStorage.getItem(REFRESH_KEY),
  set(access: string, refresh?: string) {
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

function errorMessage(data: unknown): string {
  if (!data) return "Something went wrong.";
  if (typeof data === "string") return data;
  if (typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (typeof record.detail === "string") {
      const errors = record.errors;
      if (errors && typeof errors === "object") {
        const first = Object.values(errors as Record<string, unknown>)[0];
        if (Array.isArray(first) && first.length) return String(first[0]);
        if (typeof first === "string") return first;
      }
      return record.detail;
    }
    const first = Object.values(record)[0];
    if (Array.isArray(first) && first.length) return String(first[0]);
    if (typeof first === "string") return first;
  }
  return "Something went wrong.";
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const refresh = tokenStore.refresh();
  if (!refresh) return false;
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    })
      .then(async (res) => {
        if (!res.ok) {
          tokenStore.clear();
          window.dispatchEvent(new Event("nattyrex:session-expired"));
          return false;
        }
        const data = (await res.json()) as { access: string; refresh?: string };
        tokenStore.set(data.access, data.refresh);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  anonymous?: boolean;
  raw?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const { body, anonymous, raw, headers, ...rest } = options;
  const isForm = body instanceof FormData;
  const finalHeaders = new Headers(headers);
  if (!isForm && body !== undefined) finalHeaders.set("Content-Type", "application/json");
  if (!anonymous) {
    const access = tokenStore.access();
    if (access) finalHeaders.set("Authorization", `Bearer ${access}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && !anonymous && !retried && tokenStore.refresh()) {
    const refreshed = await refreshSession();
    if (refreshed) return apiFetch<T>(path, options, true);
  }

  if (response.status === 204) return undefined as T;

  let payload: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, errorMessage(payload), payload);
  }
  if (raw) return response as unknown as T;
  return payload as T;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, form: FormData, method: "POST" | "PATCH" = "POST") =>
    apiFetch<T>(path, { method, body: form }),
  anonymousPost: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "POST", body, anonymous: true }),
};

export { API_URL };
