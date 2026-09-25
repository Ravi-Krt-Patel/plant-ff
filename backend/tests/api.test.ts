import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../src/app";
import { MemoryRepository } from "../src/repositories/memory";
import type { Order, Quote, PaymentAttempt } from "../src/contracts";
import { configSchema } from "../src/config";
let app: FastifyInstance;
let repo: MemoryRepository;
let now: number;
const opsToken = "operations-test-token-32-characters-long";
const address = {
  name: "Fictional Customer",
  phone: "9000000000",
  line: "12 Sample Garden Lane",
  locality: "Demo Varanasi",
  landmark: "Sample garden",
  pin: "221001",
  instructions: "Fictional details only",
};
type Auth = { cookie: string; csrf: string };
async function session(customer = false): Promise<Auth> {
  const r = await app.inject({
    method: "POST",
    url: customer ? "/api/auth/demo-sign-in" : "/api/auth/guest",
    payload: {},
  });
  expect(r.statusCode).toBe(201);
  const cookie = r.cookies.find((c) => c.name === "kg_api_session");
  if (!cookie) throw Error("Missing cookie");
  return {
    cookie: `kg_api_session=${cookie.value}`,
    csrf: r.json<{ data: { csrfToken: string } }>().data.csrfToken,
  };
}
function headers(a: Auth, key = "test-key-0001") {
  return { cookie: a.cookie, "x-csrf-token": a.csrf, "idempotency-key": key };
}
async function quote(
  a: Auth,
  options: {
    pin?: string;
    id?: string;
    quantity?: number;
    coupon?: string;
  } = {},
) {
  const delivery = await app.inject({
    method: "POST",
    url: "/api/serviceability/check",
    payload: { pin: options.pin ?? "221001" },
  });
  const slot = delivery.json<{ data: { slots: { id: string }[] } }>().data
    .slots[0];
  if (!slot) throw Error("Missing slot");
  return app.inject({
    method: "POST",
    url: "/api/checkout/quote",
    headers: headers(a),
    payload: {
      lines: [
        {
          id: options.id ?? "p1",
          variant: "nursery",
          quantity: options.quantity ?? 1,
        },
      ],
      address: { ...address, pin: options.pin ?? address.pin },
      slotId: slot.id,
      coupon: options.coupon ?? "",
    },
  });
}
async function order(
  a: Auth,
  method = "upi",
  key = "order-key-001",
  options: Parameters<typeof quote>[1] = {},
) {
  const q = await quote(a, options);
  expect(q.statusCode).toBe(201);
  const value = q.json<{ data: Quote }>().data;
  return app.inject({
    method: "POST",
    url: "/api/orders",
    headers: headers(a, key),
    payload: { quoteId: value.id, quoteVersion: value.version, method },
  });
}
async function attempt(a: Auth, id: string, key = "attempt-key-01") {
  const r = await app.inject({
    method: "POST",
    url: `/api/orders/${id}/payment-sessions`,
    headers: headers(a, key),
    payload: {},
  });
  expect(r.statusCode).toBe(201);
  return r.json<{ data: PaymentAttempt }>().data;
}
async function simulate(a: Auth, id: string, outcome: string) {
  return app.inject({
    method: "POST",
    url: `/api/payments/demo/${id}/simulate`,
    headers: headers(a),
    payload: { outcome },
  });
}
beforeEach(async () => {
  now = Date.parse("2026-09-20T04:00:00Z");
  repo = new MemoryRepository();
  app = await createApp({
    repository: repo,
    now: () => now,
    config: { operationsToken: opsToken },
  });
});
afterEach(async () => {
  await app.close();
});
describe("catalog and configuration", () => {
  it("starts without a database and lists paginated products", async () => {
    const r = await app.inject("/api/products?limit=5");
    expect(r.statusCode).toBe(200);
    const data = r.json<{
      data: { items: unknown[]; total: number; hasMore: boolean };
    }>().data;
    expect(data.items).toHaveLength(5);
    expect(data.total).toBe(24);
    expect(data.hasMore).toBe(true);
    expect((await app.inject("/api/health")).json().data.database).toBe(
      "not-connected",
    );
  });
  it("validates filtering, sorting, search and /v1 compatibility", async () => {
    const r = await app.inject("/v1/search?q=snake");
    expect(r.json().data.items[0].id).toBe("p2");
    expect((await app.inject("/api/products?limit=10000")).statusCode).toBe(
      400,
    );
    expect(
      (await app.inject("/api/products?category=unknown")).statusCode,
    ).toBe(400);
    expect(
      (await app.inject("/api/products?minPrice=500&maxPrice=1")).statusCode,
    ).toBe(400);
    const result = await app.inject(
      "/api/products?sort=price-low&maxPrice=30000",
    );
    expect(
      result
        .json()
        .data.items.every((p: { pricePaise: number }) => p.pricePaise <= 30000),
    ).toBe(true);
  });
  it("does not equate PIN syntax or prefixes with serviceability", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/serviceability/check",
      payload: { pin: "221999" },
    });
    expect(r.json().data.eligible).toBe(false);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/serviceability/check",
          payload: { pin: "221" },
        })
      ).statusCode,
    ).toBe(400);
  });
  it("fails closed for live mode or database configurations", () => {
    expect(() => configSchema.parse({ mode: "live" })).toThrow();
    expect(() => configSchema.parse({ storage: "postgres" })).toThrow();
  });
  it("has content and category endpoints", async () => {
    for (const path of [
      "/api/categories",
      "/api/collections/indoor-plants",
      "/api/plant-care",
      "/api/plant-care/your-first-plant",
      "/api/store/config",
    ])
      expect((await app.inject(path)).statusCode).toBe(200);
    expect((await app.inject("/api/products/missing")).statusCode).toBe(404);
  });
});
describe("sessions, ownership and input controls", () => {
  it("requires session and CSRF for private writes", async () => {
    expect((await app.inject("/api/orders")).statusCode).toBe(401);
    const a = await session();
    const r = await app.inject({
      method: "PUT",
      url: "/api/cart",
      headers: { cookie: a.cookie },
      payload: { lines: [] },
    });
    expect(r.statusCode).toBe(403);
    expect(r.json().error.code).toBe("csrf_failed");
  });
  it("rejects disallowed origins and cross-site mutations", async () => {
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/guest",
          headers: { origin: "https://evil.example" },
          payload: {},
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/guest",
          headers: { "sec-fetch-site": "cross-site" },
          payload: {},
        })
      ).statusCode,
    ).toBe(403);
  });
  it("rotates sessions on demo sign-in and sets protected cookies", async () => {
    const a = await session();
    const r = await app.inject({
      method: "POST",
      url: "/api/auth/demo-sign-in",
      headers: headers(a),
      payload: {},
    });
    expect(r.statusCode).toBe(201);
    expect(r.headers["set-cookie"]).toContain("HttpOnly");
    expect(r.headers["set-cookie"]).toContain("SameSite=Strict");
    expect(
      (
        await app.inject({
          url: "/api/auth/session",
          headers: { cookie: a.cookie },
        })
      ).statusCode,
    ).toBe(401);
  });
  it("expires sessions and signs out", async () => {
    const a = await session();
    const r = await app.inject({
      method: "POST",
      url: "/api/auth/sign-out",
      headers: headers(a),
      payload: {},
    });
    expect(r.statusCode).toBe(200);
    expect(
      (await app.inject({ url: "/api/orders", headers: headers(a) }))
        .statusCode,
    ).toBe(401);
    const b = await session();
    now += 9 * 3600000;
    expect(
      (await app.inject({ url: "/api/orders", headers: headers(b) }))
        .statusCode,
    ).toBe(401);
  });
  it("protects orders and payment attempts from other sessions", async () => {
    const a = await session();
    const b = await session();
    const o = (await order(a)).json<{ data: Order }>().data;
    for (const suffix of ["", "/tracking", "/payment-status"])
      expect(
        (
          await app.inject({
            url: `/api/orders/${o.id}${suffix}`,
            headers: headers(b),
          })
        ).statusCode,
      ).toBe(404);
    const p = await attempt(a, o.id);
    expect((await simulate(b, p.id, "success")).statusCode).toBe(404);
    expect(
      (await app.inject({ url: "/api/orders", headers: headers(b) })).json()
        .data.total,
    ).toBe(0);
  });
  it("bounds bodies, validates JSON and provides request IDs without caching", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/auth/guest",
      headers: { "content-type": "application/json" },
      payload: "{bad",
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().requestId).toBeTruthy();
    const a = await session();
    const privateResponse = await app.inject({
      url: "/api/orders",
      headers: headers(a),
    });
    expect(privateResponse.headers["cache-control"]).toBe("no-store");
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/contact",
          headers: headers(a),
          payload: { message: "x".repeat(40000) },
        })
      ).statusCode,
    ).toBe(413);
  });
  it("rate-limits session creation", async () => {
    let status = 0;
    for (let i = 0; i < 21; i++)
      status = (
        await app.inject({
          method: "POST",
          url: "/api/auth/guest",
          payload: {},
        })
      ).statusCode;
    expect(status).toBe(429);
  });
});
describe("quotes, resource reservations and orders", () => {
  it("calculates integer totals and rejects invalid coupons", async () => {
    const a = await session();
    const r = await quote(a, { coupon: "GROW10", quantity: 2 });
    expect(r.json().data).toMatchObject({
      subtotalPaise: 139800,
      discountPaise: 13980,
      shippingPaise: 4900,
      taxPaise: 0,
      totalPaise: 130720,
      currency: "INR",
    });
    expect((await quote(a, { coupon: "FAKE" })).statusCode).toBe(422);
    expect((await quote(a, { id: "p14" })).statusCode).toBe(409);
  });
  it("rejects client prices, expired quotes and changed catalog versions", async () => {
    const a = await session();
    const q = (await quote(a)).json<{ data: Quote }>().data;
    const payload = { quoteId: q.id, quoteVersion: 1, method: "upi" };
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/orders",
          headers: headers(a),
          payload: { ...payload, totalPaise: 1 },
        })
      ).statusCode,
    ).toBe(400);
    await repo.transaction((s) => {
      s.products.get("p1")!.version++;
    });
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/orders",
          headers: headers(a),
          payload,
        })
      ).json().error.code,
    ).toBe("price_changed");
    const q2 = (await quote(a)).json<{ data: Quote }>().data;
    now += 11 * 60000;
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/orders",
          headers: headers(a),
          payload: { ...payload, quoteId: q2.id },
        })
      ).json().error.code,
    ).toBe("quote_expired");
  });
  it("creates orders idempotently and rejects conflicting keys or reused quotes", async () => {
    const a = await session();
    const q = (await quote(a)).json<{ data: Quote }>().data;
    const request = {
      method: "POST" as const,
      url: "/api/orders",
      headers: headers(a),
      payload: { quoteId: q.id, quoteVersion: 1, method: "upi" },
    };
    const first = await app.inject(request);
    const repeat = await app.inject(request);
    expect(first.json().data.id).toBe(repeat.json().data.id);
    expect(
      (
        await app.inject({
          ...request,
          payload: { ...request.payload, method: "cod" },
        })
      ).json().error.code,
    ).toBe("idempotency_conflict");
    expect(
      (
        await app.inject({ ...request, headers: headers(a, "another-key-01") })
      ).json().error.code,
    ).toBe("quote_used");
    expect(
      (
        await app.inject({
          ...request,
          headers: { cookie: a.cookie, "x-csrf-token": a.csrf },
        })
      ).statusCode,
    ).toBe(400);
    expect((await app.inject("/api/products/p1")).json().data.stock).toBe(9);
  });
  it("atomically prevents overselling concurrent orders", async () => {
    const a = await session();
    const b = await session();
    const q1 = (await quote(a, { id: "p6", quantity: 3 })).json<{
      data: Quote;
    }>().data;
    const q2 = (await quote(b, { id: "p6", quantity: 3 })).json<{
      data: Quote;
    }>().data;
    const results = await Promise.all(
      [
        [a, q1],
        [b, q2],
      ].map(([auth, q]) => {
        const user = auth as Auth;
        const quote = q as Quote;
        return app.inject({
          method: "POST",
          url: "/api/orders",
          headers: headers(user),
          payload: { quoteId: quote.id, quoteVersion: 1, method: "upi" },
        });
      }),
    );
    expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    expect((await app.inject("/api/products/p6")).json().data.stock).toBe(0);
  });
  it("validates COD rules and reports due, never captured", async () => {
    const a = await session();
    const r = await order(a, "cod");
    expect(r.json().data.paymentStatus).toBe("due_on_delivery");
    expect(r.json().data.fulfillment).toBe("confirmed");
    const p = await app.inject({
      method: "POST",
      url: `/api/orders/${r.json().data.id}/payment-sessions`,
      headers: headers(a),
      payload: {},
    });
    expect(p.statusCode).toBe(409);
    expect(
      (await order(a, "cod", "order-key-002", { pin: "221010" })).json().error
        .code,
    ).toBe("cod_unavailable");
    expect(
      (await order(a, "cod", "order-key-003", { id: "p5", quantity: 3 })).json()
        .error.code,
    ).toBe("cod_unavailable");
  });
  it("releases expired unpaid reservations exactly once", async () => {
    const a = await session();
    const o = (await order(a)).json<{ data: Order }>().data;
    now += 16 * 60000;
    const r = await app.inject({
      url: `/api/orders/${o.id}`,
      headers: headers(a),
    });
    expect(r.json().data.fulfillment).toBe("expired");
    await app.inject({ url: `/api/orders/${o.id}`, headers: headers(a) });
    expect((await app.inject("/api/products/p1")).json().data.stock).toBe(10);
  });
});
describe("simulated payments and cancellation", () => {
  it("reuses an active payment and allows retry after failure on the same order", async () => {
    const a = await session();
    const o = (await order(a)).json<{ data: Order }>().data;
    const first = await attempt(a, o.id);
    expect((await attempt(a, o.id, "attempt-key-02")).id).toBe(first.id);
    expect(
      (await simulate(a, first.id, "failure")).json().data.order.paymentStatus,
    ).toBe("failed");
    const retry = await attempt(a, o.id, "attempt-key-03");
    expect(retry.id).not.toBe(first.id);
    expect(
      (await simulate(a, retry.id, "success")).json().data.order.paymentStatus,
    ).toBe("captured");
    expect((await simulate(a, retry.id, "success")).statusCode).toBe(200);
    expect((await simulate(a, retry.id, "failure")).statusCode).toBe(409);
  });
  it.each(["pending", "timeout", "dismissed"] as const)(
    "preserves honest %s states",
    async (outcome) => {
      const a = await session();
      const o = (await order(a)).json<{ data: Order }>().data;
      const p = await attempt(a, o.id);
      const r = await simulate(a, p.id, outcome);
      expect(r.json().data.order.paymentStatus).toBe(
        outcome === "timeout" ? "pending" : outcome,
      );
      expect(r.json().data.order.fulfillment).toBe("awaiting_payment");
    },
  );
  it("cancels once and requests, rather than completes, a captured refund", async () => {
    const a = await session();
    const o = (await order(a)).json<{ data: Order }>().data;
    const p = await attempt(a, o.id);
    await simulate(a, p.id, "success");
    const r = await app.inject({
      method: "POST",
      url: `/api/orders/${o.id}/cancellation-requests`,
      headers: headers(a),
      payload: { reason: "Changed my mind" },
    });
    expect(r.json().data.paymentStatus).toBe("refund_requested");
    await app.inject({
      method: "POST",
      url: `/api/orders/${o.id}/cancellation-requests`,
      headers: headers(a),
      payload: { reason: "Changed my mind" },
    });
    expect((await app.inject("/api/products/p1")).json().data.stock).toBe(10);
  });
  it.each(["cancelled", "expired"])(
    "sends captures after %s to reconciliation, not fulfillment",
    async (scenario) => {
      const a = await session();
      const o = (await order(a)).json<{ data: Order }>().data;
      const p = await attempt(a, o.id);
      if (scenario === "cancelled")
        await app.inject({
          method: "POST",
          url: `/api/orders/${o.id}/cancellation-requests`,
          headers: headers(a),
          payload: { reason: "No longer needed" },
        });
      else now += 16 * 60000;
      const r = await simulate(a, p.id, "success");
      expect(r.json().data.order.paymentStatus).toBe("reconciliation_required");
      expect(r.json().data.order.fulfillment).toBe(scenario);
      expect((await app.inject("/api/products/p1")).json().data.stock).toBe(10);
    },
  );
  it("never treats a fake Razorpay callback or webhook as payment success", async () => {
    const a = await session();
    for (const url of [
      "/api/payments/razorpay/create-order",
      "/api/payments/razorpay/verify",
      "/api/webhooks/razorpay",
    ]) {
      const r = await app.inject({
        method: "POST",
        url,
        headers: headers(a),
        payload: { razorpay_signature: "fake" },
      });
      expect(r.statusCode).toBe(503);
      expect(r.json().error.code).toBe("provider_not_configured");
    }
  });
});
describe("addresses, saved selections, guest access and operations", () => {
  it("provides isolated address CRUD with customer guard", async () => {
    const guest = await session();
    expect(
      (await app.inject({ url: "/api/addresses", headers: headers(guest) }))
        .statusCode,
    ).toBe(403);
    const a = await session(true);
    const b = await session(true);
    const r = await app.inject({
      method: "POST",
      url: "/api/addresses",
      headers: headers(a),
      payload: address,
    });
    const id = r.json().data.id;
    expect(r.statusCode).toBe(201);
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: `/api/addresses/${id}`,
          headers: headers(b),
          payload: { name: "Someone else" },
        })
      ).statusCode,
    ).toBe(404);
    const patched = await app.inject({
      method: "PATCH",
      url: `/api/addresses/${id}`,
      headers: headers(a),
      payload: { name: "New Demo Name" },
    });
    expect(patched.json().data.name).toBe("New Demo Name");
    expect(patched.json().data.landmark).toBe(address.landmark);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/api/addresses/${id}`,
          headers: headers(a),
        })
      ).statusCode,
    ).toBe(200);
  });
  it("validates variant carts and idempotent wishlists", async () => {
    const a = await session();
    const lines = [{ id: "p1", variant: "ceramic", quantity: 2 }];
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/api/cart",
          headers: headers(a),
          payload: { lines },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ url: "/api/cart", headers: headers(a) })).json().data
        .lines,
    ).toEqual(lines);
    for (let i = 0; i < 2; i++)
      await app.inject({
        method: "PUT",
        url: "/api/wishlist/p1",
        headers: headers(a),
      });
    expect(
      (await app.inject({ url: "/api/wishlist", headers: headers(a) })).json()
        .data.productIds,
    ).toEqual(["p1"]);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/api/cart",
          headers: headers(a),
          payload: { lines: [...lines, ...lines] },
        })
      ).statusCode,
    ).toBe(400);
  });
  it("requires an expiring order-scoped capability for guest lookup", async () => {
    const a = await session();
    const o = (await order(a, "cod")).json<{ data: Order }>().data;
    const access = await app.inject({
      method: "POST",
      url: `/api/orders/${o.id}/guest-access`,
      headers: headers(a),
    });
    const payload = access.json().data;
    const lookup = () =>
      app.inject({
        method: "POST",
        url: "/api/orders/lookup",
        payload: { orderId: o.id, accessToken: payload.accessToken },
      });
    expect((await lookup()).statusCode).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/orders/lookup",
          payload: { orderId: "other", accessToken: payload.accessToken },
        })
      ).statusCode,
    ).toBe(404);
    now += 31 * 60000;
    expect((await lookup()).statusCode).toBe(404);
  });
  it("limits tracking to active delivery and rejects stale updates", async () => {
    const a = await session();
    const o = (await order(a, "cod")).json<{ data: Order }>().data;
    const op = { authorization: `Bearer ${opsToken}` };
    const transition = (status: string) =>
      app.inject({
        method: "PATCH",
        url: `/api/operations/orders/${o.id}/fulfillment`,
        headers: op,
        payload: { status },
      });
    expect((await transition("delivered")).statusCode).toBe(409);
    await transition("preparing");
    await transition("out_for_delivery");
    const update = {
      method: "POST" as const,
      url: `/api/operations/orders/${o.id}/tracking`,
      headers: op,
      payload: {
        sequence: 1,
        recordedAt: new Date(now).toISOString(),
        coordinates: { latitude: 25.3, longitude: 83, accuracyMeters: 100 },
      },
    };
    expect((await app.inject(update)).statusCode).toBe(200);
    expect((await app.inject(update)).statusCode).toBe(409);
    const tracking = () =>
      app.inject({ url: `/api/orders/${o.id}/tracking`, headers: headers(a) });
    expect((await tracking()).json().data.locationAvailable).toBe(true);
    now += 61000;
    expect((await tracking()).json().data.stale).toBe(true);
    await transition("delivered");
    expect((await tracking()).json().data.coordinates).toBeNull();
  });
  it("protects operations and keeps contacts local-only", async () => {
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: "/api/operations/products/p1",
          payload: { stock: 9 },
        })
      ).statusCode,
    ).toBe(401);
    const a = await session();
    const r = await app.inject({
      method: "POST",
      url: "/api/contact",
      headers: headers(a),
      payload: {
        name: "Demo Person",
        email: "demo@example.com",
        message: "A fictional support message",
      },
    });
    expect(r.statusCode).toBe(201);
    expect(r.json().data.sent).toBe(false);
  });
  it("rolls back failed repository transactions", async () => {
    await expect(
      repo.transaction((s) => {
        s.products.get("p1")!.stock = 0;
        throw new Error("rollback");
      }),
    ).rejects.toThrow();
    expect((await app.inject("/api/products/p1")).json().data.stock).toBe(10);
  });
});
