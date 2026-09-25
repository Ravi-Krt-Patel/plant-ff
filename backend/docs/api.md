# API contract and usage

Base URL: `http://localhost:4000/api`. `/v1` is an alias, not a different version of the schema. OpenAPI: `/api/openapi.json`.

Successful responses use `{ data, requestId, meta: { mode: "demo", storage: "memory" } }`. Errors use `{ error: { code, message, details?, retryable }, requestId }`. Health and all business responses are marked demo; no claim of real delivery/payment/authentication is made. All responses use no-store caching. IDs are opaque; timestamps are ISO 8601; INR amounts are integer paise.

## Session and request sequence

1. POST `/auth/guest` with `{}` for guest checkout, or POST `/auth/demo-sign-in` for a fictional customer address book. These create a random session and return `csrfToken`. The random session cookie is HttpOnly, SameSite=Strict and hashed in server memory. Sessions last eight hours by default. Demo sign-in is not identity verification and cannot recover a prior account after logout or server restart.
2. Preserve the `kg_api_session` cookie. Browser calls use `credentials: 'include'`. Origins default to `http://localhost:3000` and `http://localhost:3001`. A session cookie already present on sign-in/start requires its valid CSRF token; sign-in rotates the cookie and CSRF token while preserving ownership.
3. Every session-authenticated write requires `X-CSRF-Token` from the current session. GET `/auth/session` returns it after page reload. Missing/invalid tokens are rejected. Public eligibility checks and order-token lookup do not mutate owned data and do not require a session.
4. POST `/serviceability/check` with `{ "pin": "221001" }`. Use an actual returned slot ID, not a hard-coded date. Demo zones are 221001, 221005 and 221010; the latter is prepaid-only. Demo COD is capped at ₹2,000 per order. Tax is zero in the sample configuration, not a legal/tax assertion.
5. POST `/checkout/quote` with `lines`, `address`, `slotId`, optional `coupon`. Quote input accepts only SKU identifiers/variant/quantity, never a trusted client price. Quotes expire after ten minutes and do not reserve anything.
6. POST `/orders` with `{ "quoteId": "...", "quoteVersion": 1, "method": "upi" }` and a unique `Idempotency-Key`. A quote may create one commerce order only. Creating an order recalculates/checks prices and availability, then reserves product stock and slot capacity atomically in memory. UPI/card reservations expire after 15 minutes; expiry releases stock/slot once. Confirmed COD and captured prepaid keep their resources committed.
7. COD returns `paymentStatus: due_on_delivery`, `fulfillment: confirmed`. Prepaid starts unpaid/awaiting_payment. Start an attempt via POST `/orders/{id}/payment-sessions` with `{}` and an idempotency key, then select a simulated outcome via POST `/payments/demo/{attemptId}/simulate`.
8. GET `/orders/{id}/payment-status` or `/orders/{id}` for the server-held demo state. Neither query parameters nor a fabricated Razorpay callback can mark anything paid.

## Endpoint inventory

| Method           | Path                                                                           | Purpose / access                                             |
| ---------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| GET              | /health                                                                        | Health and storage mode                                      |
| GET              | /openapi.json                                                                  | Machine-readable OpenAPI                                     |
| GET              | /products, /search                                                             | Filtered, sorted, paginated catalog                          |
| GET              | /products/{slug}                                                               | Product slug or ID lookup                                    |
| GET              | /categories                                                                    | Sample taxonomy                                              |
| GET              | /collections/{slug}                                                            | Collection catalog page                                      |
| GET              | /plant-care, /plant-care/{slug}                                                | Care guides                                                  |
| GET              | /store/config                                                                  | Demo store settings                                          |
| POST             | /serviceability/check                                                          | Exact PIN eligibility and slots                              |
| POST             | /auth/guest, /auth/demo-sign-in                                                | Start/rotate isolated session                                |
| GET              | /auth/session                                                                  | Session and CSRF token                                       |
| POST             | /auth/sign-out                                                                 | Revoke session                                               |
| POST             | /auth/otp/request, /auth/otp/verify                                            | Explicitly unavailable real-provider boundary                |
| GET, POST        | /addresses                                                                     | Customer-owned address list/create                           |
| PATCH, DELETE    | /addresses/{id}                                                                | Customer-owned address changes                               |
| GET, PUT, DELETE | /cart                                                                          | Guest/customer cart read, replacement, clear                 |
| GET              | /wishlist                                                                      | Owned product IDs                                            |
| PUT, DELETE      | /wishlist/{id}                                                                 | Idempotent save/removal                                      |
| POST             | /checkout/quote, /checkout/quotes                                              | Trusted temporary quote                                      |
| GET, POST        | /orders                                                                        | Owned history / idempotent creation                          |
| GET              | /orders/{id}                                                                   | Owned order details                                          |
| POST             | /orders/{id}/payment-sessions                                                  | Start/reuse simulated attempt                                |
| GET              | /orders/{id}/payment-status                                                    | Owned payment state                                          |
| POST             | /payments/demo/{id}/simulate                                                   | Explicit simulation outcome                                  |
| POST             | /orders/{id}/cancellation-requests                                             | Idempotent cancellation request                              |
| GET              | /orders/{id}/tracking                                                          | Owned tracking snapshot                                      |
| POST             | /orders/{id}/guest-access                                                      | Issue 30-minute order-scoped capability; rotates old one     |
| POST             | /orders/lookup                                                                 | Require order ID and its capability, never phone-only access |
| POST             | /payments/razorpay/create-order, /payments/razorpay/verify, /webhooks/razorpay | Fail-closed provider boundaries, HTTP 503                    |
| POST             | /contact                                                                       | Temporary demo support record; no email                      |
| PATCH            | /operations/products/{id}                                                      | Server-token-only demo stock/price update                    |
| PATCH            | /operations/orders/{id}/fulfillment                                            | Server-token-only fulfillment transition                     |
| POST             | /operations/orders/{id}/tracking                                               | Server-token-only synthetic coordinates                      |
| POST             | /operations/orders/{id}/collect-cod                                            | Simulate collection after delivery                           |
| POST             | /operations/orders/{id}/refund-completed                                       | Settle only a simulated refund/reconciliation case           |

## Queries and data shapes

Catalog accepts `q`, `category`, `minPrice`, `maxPrice` (paise), `light`, `care`, `size`, `planter`, `availability`, `sort`, `page`, `limit`. Enums are listed in `src/contracts.ts` and OpenAPI. Invalid or unknown filters return 400. Page defaults to 1, limit defaults to 12, maximum 50. Results include `items, page, limit, total, hasMore`. Search applies the same bounded pagination. Orders accept page/limit only. The HTTP client may cancel via AbortSignal; catalog computations are synchronous and bounded, with no background search task to cancel.

Cart line: `{ id: "p1", variant: "nursery" | "ceramic", quantity: 1..10 }`. Stock is shared across the two planter variants for the same plant. Quotes merge repeated variants and enforce cumulative stock; PUT cart rejects duplicate variant lines.

Address: `{ name, phone, line, locality, landmark, pin, instructions }`. Landmark and instructions may be omitted on creation. PATCH changes only supplied fields and preserves the rest. Enter only fictional details in this demonstration.

Quote response contains `id, version, lines, address, slotId, coupon, subtotalPaise, discountPaise, shippingPaise, taxPaise, totalPaise, currency, createdAt, expiresAt, codEligible, demo`. Quote lines contain server unit/line prices and product versions.

Orders include line snapshots, address, slot, server total, method, paymentStatus, fulfillment, resource-release flag, version and timestamps. Session ownership is checked on every private endpoint. Cross-owner resources return 404 to avoid exposing their existence.

## Transitions and retries

Payment attempt: initiating → pending / captured / failed / dismissed. Timeout is pending, not failure. Pending may later resolve; terminal attempts cannot change outcome. Repeated matching outcomes return existing state. Only one active attempt per order is allowed. A failed/dismissed attempt may be retried on the SAME commerce order with a new idempotency key. Reusing an old key returns that key's original attempt snapshot; fetch payment-status for current state.

Order fulfillment: awaiting_payment → confirmed → preparing → out_for_delivery → delivered; eligible early states may cancel. Unpaid reservation expiry yields expired. Captures after expiry/cancellation yield reconciliation_required and never restart fulfillment. Cancellation of captured payment yields refund_requested, not refunded. Only the protected demo operation marks that case refunded.

Idempotency keys contain 8–100 ASCII letters/digits/underscores/hyphens. Records are scoped to owner and operation, kept for 24 hours or until session cleanup. Same key + different parsed request returns 409. Keys and resource state disappear after a server restart. No distributed idempotency is claimed.

## Errors, limits and privacy

400 validation_error / idempotency_key_required; 401 unauthorized/session_expired; 403 csrf_failed/customer_required/origin_not_allowed; 404 not_found; 409 quote_expired/quote_used/price_changed/out_of_stock/slot_unavailable/invalid_transition/idempotency_conflict; 422 invalid_coupon/unserviceable/cod_unavailable; 429 rate_limited/resource_limit; 503 provider_not_configured/operations_disabled/capacity_reached.

32 KiB body limit; per-IP 120 requests/minute globally with tighter limits for auth, quotes, orders, lookup, contact and serviceability. Proxy headers are not trusted by default. Distributed proxy/rate-limit configuration is a launch dependency. Per-session quotas bound quotes/orders/addresses/contact records. A one-minute sweep expires reservations and removes expired/unowned session records and tokens. Revoked/expired customer sessions lose access immediately; guest capabilities remain separately valid up to their expiry or record cleanup. No PII or auth headers are emitted by routine request logging; error logs contain request ID, status and safe code only.

Operations API is disabled unless BACKEND_OPERATIONS_TOKEN is configured to at least 32 random characters. Never expose it in a browser. Stock edits set **available** stock, not original stock before reservations. All operations remain demo-only. Synthetic tracking updates require increasing sequence numbers, non-regressing timestamps and an active delivery; coordinates are hidden after cancellation/delivery. Staleness is explicit after 60 seconds. No real rider app, GPS collection, geocoding or Google Maps call is supplied.
