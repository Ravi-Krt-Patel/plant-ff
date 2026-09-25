# Kashi Greens backend

A separate TypeScript/Fastify API service for the existing storefront. **No database is connected.** State is held in process memory and resets whenever the API restarts. The existing frontend and its mock wiring were not changed.

## Start

From the project root (Node 22.22+ and pnpm 10.17.1):

```sh
pnpm install --frozen-lockfile
pnpm backend:dev
```

This compiles the backend and starts it at `http://localhost:4000`. `backend:dev` is a build-and-start command, not a watch process. Restart it after source changes. For a previously built backend, run `pnpm backend:start`.

- Health: `http://localhost:4000/api/health`
- Catalog: `http://localhost:4000/api/products`
- OpenAPI 3.1: `http://localhost:4000/api/openapi.json`
- Every `/api` endpoint also accepts the equivalent `/v1` prefix.

Optional: copy `backend/.env.example` to `backend/.env`. No secrets, merchant account, database URL or paid service is required. The environment file is ignored by Git. The backend binds to loopback by default.

## What works

- 24 sample products, variants, configurable taxonomy, detail lookup, search, price/light/care/size/planter/availability filters, sorting and bounded pagination.
- Exact demo PIN eligibility, ₹49 sample shipping, two next-day illustrative slots, capacity checks and COD eligibility. These are **not verified business rules**.
- Server-calculated integer-paise quotes, GROW10 coupon, price/version checking, quote expiry, stock and slot reservation, idempotent order creation, and atomic single-process stock updates.
- Guest sessions, explicit demo-customer sign-in, session rotation/sign-out, HttpOnly cookies, CSRF validation, origin allowlist, request size limits, rate limits, uniform error envelopes and request IDs.
- Owned order history/details, payment status, cancellation, separated payment and fulfillment states, demo payment attempts/retries, pending/failure/dismissal/timeout and late-success reconciliation.
- Customer address CRUD, session cart and wishlist APIs, in-memory contact messages, care-guide APIs and public store configuration.
- Order-scoped, expiring guest access tokens. An order number or phone number alone grants no access.
- Text tracking and optional synthetic coordinates. Authenticated operations endpoints can advance demo fulfillment, inject synthetic location snapshots, record demo COD collection or settle a simulated refund case.

## Important boundaries

Payments are explicit simulations. Real Razorpay creation/verification/webhook and OTP endpoints return `503 provider_not_configured`. They do not validate real signatures, send SMS, charge, capture or refund money. `BACKEND_MODE=live` and storage values other than `memory` fail startup instead of silently using demo success. Do not connect real payment callbacks to this process-memory service.

No frontend pages or client adapters were rewired. When frontend integration is requested, use `credentials: 'include'`, fetch `/api/auth/session` for the current CSRF token and send it on authenticated mutations. See [API guide](docs/api.md) and [request examples](requests.http).

## Checks

```sh
pnpm backend:typecheck
pnpm backend:build
pnpm backend:test
pnpm backend:test --coverage
node backend/smoke.mjs
```

The smoke script needs the running local API. Tests use Fastify's HTTP injection boundary with a fresh repository and injected clock for each case; no database or bank is contacted. Tests exercise real handlers, cookies, CSRF, validation and transactions. These are backend HTTP tests, not frontend MSW mocks.

## Layout

`src/app.ts` composes the HTTP server; `routes/` handles HTTP and validation; `domain/` owns catalog, sessions, checkout and payment transitions; `repositories/memory.ts` owns transient state and atomic commit/rollback; `contracts.ts` contains types and Zod request schemas; `openapi.ts` serves API discovery; `server.ts` owns environment parsing and shutdown.

The memory repository commits synchronous transaction callbacks without awaiting inside the critical section. This prevents interleaving within **one Node process only**. Read and transaction results are cloned to prevent callers mutating stored state. Database work must replace this with database-backed queries and real transactions/locking; callbacks over an in-memory aggregate are not a claim of a production database abstraction. See [database handoff](docs/database-handoff.md).
