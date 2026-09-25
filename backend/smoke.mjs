import assert from "node:assert/strict";
const base = process.env.BACKEND_SMOKE_URL ?? "http://localhost:4000/api";
const session = await fetch(`${base}/auth/guest`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{}",
});
assert.equal(session.status, 201);
const cookie = session.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie);
const { data: auth } = await session.json();
const headers = {
  "content-type": "application/json",
  cookie,
  "x-csrf-token": auth.csrfToken,
};
async function call(path, body, key) {
  const response = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { ...headers, ...(key ? { "idempotency-key": key } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  assert.ok(response.ok, `${path}: HTTP ${response.status}`);
  return (await response.json()).data;
}
const products = await call("/products?limit=2");
assert.equal(products.items.length, 2);
const delivery = await call("/serviceability/check", { pin: "221001" });
const quote = await call("/checkout/quote", {
  lines: [{ id: "p1", variant: "nursery", quantity: 1 }],
  address: {
    name: "Demo Customer",
    phone: "9000000000",
    line: "12 Sample Garden Lane",
    locality: "Demo Varanasi",
    pin: "221001",
  },
  slotId: delivery.slots[0].id,
  coupon: "GROW10",
});
const order = await call(
  "/orders",
  { quoteId: quote.id, quoteVersion: quote.version, method: "upi" },
  "smoke-order-0001",
);
const attempt = await call(
  `/orders/${order.id}/payment-sessions`,
  {},
  "smoke-attempt-0001",
);
const payment = await call(`/payments/demo/${attempt.id}/simulate`, {
  outcome: "success",
});
assert.equal(payment.order.paymentStatus, "captured");
const cancelled = await call(
  `/orders/${order.id}/cancellation-requests`,
  { reason: "Finish smoke demonstration" },
  "smoke-cancel-0001",
);
assert.equal(cancelled.paymentStatus, "refund_requested");
const spec = await fetch(base + "/openapi.json");
assert.equal(spec.status, 200);
assert.equal((await spec.json()).openapi, "3.1.0");
await call("/auth/sign-out", {});
console.log(
  "PASS: live HTTP catalog → guest session → quote → order → simulated payment → cancellation; OpenAPI verified. No database or real payment used.",
);
