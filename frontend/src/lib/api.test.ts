import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, tokenStore } from "./api";

const jsonResponse = (status: number, data: unknown) => ({
  status,
  ok: status >= 200 && status < 300,
  text: async () => JSON.stringify(data),
  json: async () => data,
});

const emptyResponse = (status: number) => ({
  status,
  ok: status >= 200 && status < 300,
  text: async () => "",
  json: async () => null,
});

describe("api client", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("attaches the access token to authenticated requests", async () => {
    tokenStore.set("access-123", "refresh-123");
    const fetchMock = vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { count: 0 }) as never);

    const result = await api.get<{ count: number }>("/clients/");

    expect(result.count).toBe(0);
    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer access-123");
  });

  it("does not attach a token to anonymous requests", async () => {
    tokenStore.set("access-123", "refresh-123");
    const fetchMock = vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { access: "a" }) as never);

    await api.anonymousPost("/auth/login/", { identifier: "a", password: "b" });

    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init?.headers).get("Authorization")).toBeNull();
  });

  it("refreshes an expired access token and retries once", async () => {
    tokenStore.set("expired", "refresh-123");
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(401, { detail: "Expired" }) as never)
      .mockResolvedValueOnce(jsonResponse(200, { access: "fresh", refresh: "rotated" }) as never)
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }) as never);

    const result = await api.get<{ ok: boolean }>("/trainer/dashboard/");

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(tokenStore.access()).toBe("fresh");
    expect(tokenStore.refresh()).toBe("rotated");
    const retryInit = fetchMock.mock.calls[2][1];
    expect(new Headers(retryInit?.headers).get("Authorization")).toBe("Bearer fresh");
  });

  it("clears the session and emits an expiry event when refresh fails", async () => {
    tokenStore.set("expired", "refresh-123");
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(401, { detail: "Expired" }) as never)
      .mockResolvedValueOnce(jsonResponse(401, { detail: "Invalid refresh" }) as never);

    const expired = vi.fn();
    window.addEventListener("nattyrex:session-expired", expired);

    await expect(api.get("/clients/")).rejects.toMatchObject({ status: 401 });
    expect(tokenStore.access()).toBeNull();
    expect(tokenStore.refresh()).toBeNull();
    expect(expired).toHaveBeenCalledTimes(1);

    window.removeEventListener("nattyrex:session-expired", expired);
  });

  it("returns undefined for 204 responses", async () => {
    vi.mocked(fetch).mockResolvedValue(emptyResponse(204) as never);
    await expect(api.delete("/clients/1/")).resolves.toBeUndefined();
  });

  it("extracts useful validation messages", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(400, { detail: "Validation failed.", errors: { email: ["Already in use."] } }) as never,
    );

    const error = await api.post("/clients/", {}).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).message).toBe("Already in use.");
  });

  it("sends JSON bodies for standard mutations", async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(jsonResponse(201, { id: "1" }) as never);
    await api.post("/programs/", { name: "Strength" });
    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
    expect(init?.body).toBe(JSON.stringify({ name: "Strength" }));
  });
});
