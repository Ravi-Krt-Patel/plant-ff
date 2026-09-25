import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
const reply = (data: unknown, status = 200) =>
  new Response(
    JSON.stringify(
      status >= 400 ? { error: data } : { data, requestId: "test-request" },
    ),
    { status, headers: { "content-type": "application/json" } },
  );
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:4000/v1");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("credentialed delivery transport", () => {
  it("deduplicates bootstrap and sends cookie credentials, CSRF and retry key", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(reply({ csrfToken: "first-csrf" }))
      .mockImplementation(() => Promise.resolve(reply({ id: "order-1" })));
    vi.stubGlobal("fetch", fetcher);
    const { apiRequest } = await import("@/features/delivery/api");
    const schema = z.object({ id: z.string() });
    await Promise.all([
      apiRequest("/orders", schema, {
        method: "POST",
        body: { quoteId: "quote-1", version: 1 },
        idempotencyKey: "same-order-key",
      }),
      apiRequest("/orders/order-1", schema),
    ]);
    expect(
      fetcher.mock.calls.filter(([url]) => url.endsWith("/auth/csrf")),
    ).toHaveLength(1);
    const mutation = fetcher.mock.calls.find(
      ([url, options]) => url.endsWith("/orders") && options.method === "POST",
    )!;
    expect(mutation[1]).toMatchObject({
      credentials: "include",
      cache: "no-store",
      headers: {
        "X-CSRF-Token": "first-csrf",
        "Idempotency-Key": "same-order-key",
      },
    });
  });
  it("uses the rotated token after OTP verification", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(reply({ csrfToken: "initial" }))
      .mockResolvedValueOnce(
        reply({ csrfToken: "rotated", user: { id: "u1" } }),
      )
      .mockResolvedValueOnce(reply({ deleted: true }));
    vi.stubGlobal("fetch", fetcher);
    const { apiRequest } = await import("@/features/delivery/api");
    await apiRequest("/auth/otp/verify", z.object({ csrfToken: z.string() }), {
      method: "POST",
      body: { challengeId: "c", code: "123456" },
    });
    await apiRequest("/addresses/a1", z.object({ deleted: z.boolean() }), {
      method: "DELETE",
    });
    expect(fetcher.mock.calls[2]![1].headers["X-CSRF-Token"]).toBe("rotated");
  });
  it("does not retry a failed side effect or return fabricated data", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(reply({ csrfToken: "token" }))
      .mockResolvedValueOnce(
        reply({ code: "stock_changed", message: "Stock changed" }, 409),
      );
    vi.stubGlobal("fetch", fetcher);
    const { apiRequest } = await import("@/features/delivery/api");
    await expect(
      apiRequest("/orders", z.object({ id: z.string() }), {
        method: "POST",
        body: { quoteId: "q", version: 1 },
        idempotencyKey: "key",
      }),
    ).rejects.toMatchObject({ code: "stock_changed", status: 409 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("rejects malformed success payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(reply({ csrfToken: "token" }))
        .mockResolvedValueOnce(reply({ wrong: true })),
    );
    const { apiRequest } = await import("@/features/delivery/api");
    await expect(
      apiRequest("/orders/o", z.object({ id: z.string() })),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
  it("cancels the request after session bootstrap if the caller unmounts", async () => {
    const fetcher = vi.fn().mockResolvedValue(reply({ csrfToken: "token" }));
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    controller.abort();
    const { apiRequest } = await import("@/features/delivery/api");
    await expect(
      apiRequest("/orders/o", z.unknown(), { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
