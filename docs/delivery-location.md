# Delivery addresses, map pins, checkout and order tracking

This document covers the storefront in `C:\Dev\plant-ecommerce` and its integration with the standalone NestJS backend in `C:\Dev\plant-backend`. The backend's detailed persistence and rider contracts are in `C:\Dev\plant-backend\docs\delivery-location.md`.

## What is implemented

- A delivery address contains a full name, Indian mobile number, house/building/street, locality, city, state, six-digit PIN, optional landmark/instructions, and a latitude/longitude pair.
- Signed-in customers can add, edit, remove and set a default saved address. Checkout selects the default when the form has not already been edited, allows another saved address, and allows editing or creating an address.
- Guest checkout accepts the same complete delivery details and saves them with the order. Guests do not receive an address book until signing in.
- The server calculates a quote using the selected delivery address, available slot, payment method and cart variants. The order references that quote and retains an immutable copy of its delivery address and coordinates.
- Tracking displays status history, the written delivery address, destination pin, booked delivery time when available, and an actual reported rider position only when one is available. There is no simulated moving driver or fabricated route.
- Existing orders and saved addresses without coordinates remain readable. Their UI explains that no delivery pin was recorded. New addresses, edits and new checkout quotes require the complete address and pin.

## Two frontend modes

| Configuration                                       | Address and order behavior                                                                                                                                                                                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` is empty                 | Frontend demo mode. Addresses and demo orders stay in the current tab's React state and disappear on reload. New demo orders retain the selected address/pin for display while that tab is open. No address or order is written to the backend. |
| `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/v1` | Backend mode. The storefront uses the NestJS session, saved address, serviceability, quote, order, payment-session and tracking APIs. Backend failures remain visible; the app does not silently create a local demo order instead.             |

Catalog/product pages and the browser cart still use the existing frontend catalog. The backend demo seed creates matching variant IDs (`<product-id>-nursery` and `<product-id>-ceramic`) so checkout can validate these cart lines. Backend prices and stock are authoritative at quote/order time. The older `C:\Dev\plant-ecommerce\backend` Fastify demo is not the API used by this feature.

## Run the persisted flow locally

Dummy connection strings are placeholders, not running services. The NestJS backend needs a reachable PostgreSQL database and Redis, plus applied migrations. It has no memory-storage fallback.

Use Node.js 22.22.0 or a newer Node 22 patch release and pnpm 10.17.1. PostgreSQL/Redis can be installed separately or started using Docker Desktop with Linux containers. The backend's compose file uses PostgreSQL 17.6 and Redis 7.4.5.

In `C:\Dev\plant-backend`, prepare `.env` from `.env.example` if it is absent. Set `DATABASE_URL` and `REDIS_URL` to the running local services. The included Docker compose database matches the example local URL. Generate unique development session/OTP protection secrets with the provided script instead of retaining dummy secret values. Keep these local demo settings:

```dotenv
APP_ENV=development
HOST=127.0.0.1
PORT=4000
ALLOWED_ORIGINS=http://localhost:3000
COOKIE_SECURE=false
PAYMENT_PROVIDER=fake
MESSAGING_PROVIDER=local
STORAGE_PROVIDER=local
TRACKING_PROVIDER=local
TRACKING_STALE_SECONDS=60
```

For an existing `.env`, preserve working values; do not overwrite it with the example. Run:

```powershell
Set-Location 'C:\Dev\plant-backend'
npx --yes pnpm@10.17.1 install --frozen-lockfile
npx --yes pnpm@10.17.1 env:init
npx --yes pnpm@10.17.1 env:secrets
# If using the supplied local Docker services:
docker compose up -d postgres redis
npx --yes pnpm@10.17.1 db:generate
npx --yes pnpm@10.17.1 db:migrate:deploy
npx --yes pnpm@10.17.1 db:seed:demo
npx --yes pnpm@10.17.1 build
npx --yes pnpm@10.17.1 start
```

Run the worker in a second backend terminal:

```powershell
Set-Location 'C:\Dev\plant-backend'
npx --yes pnpm@10.17.1 worker
```

The worker handles existing payment/outbox/expiration work. For a prepaid fake payment, it may need to prepare the payment session before checkout can open it; the UI offers a retry that preserves the order.

The API is at [localhost:4000/v1](http://localhost:4000/v1), and its development Swagger UI is at [localhost:4000/docs](http://localhost:4000/docs). Stop any older demo process using port 4000, or choose a different backend `PORT` and update the frontend URL to match.

Create or edit `C:\Dev\plant-ecommerce\.env.local`:

```dotenv
NEXT_PUBLIC_DATA_SOURCE=mock
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/v1
NEXT_PUBLIC_MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
```

The default attribution links to OpenStreetMap contributors. To use another raster tile provider, set `NEXT_PUBLIC_MAP_TILE_URL` to its Leaflet-compatible `{z}/{x}/{y}` URL template and set `NEXT_PUBLIC_MAP_ATTRIBUTION` to its required attribution. `NEXT_PUBLIC_*` values are visible in browser code; use only browser-safe provider configuration and restricted public keys, never server secrets.

```powershell
Set-Location 'C:\Dev\plant-ecommerce'
npx --yes pnpm@10.17.1 install --frozen-lockfile
npx --yes pnpm@10.17.1 dev
```

Open [localhost:3000](http://localhost:3000). Restart the dev server after changing public environment variables, and rebuild any static export because these variables are embedded at build time. Use the same hostname consistently for frontend and backend, such as `localhost` for both. Set backend `ALLOWED_ORIGINS` to the exact frontend origin, including its port. A deployed site requires HTTPS for browser geolocation and correctly configured secure cookies/CORS; localhost is the browser development exception.

## Map and browser permission behavior

The map uses **Leaflet 1.9.4**, loaded in the browser only after the user presses **Load map**. No existing real map provider was present; the old tracking placeholder was an illustration. Tiles default to the standard OpenStreetMap HTTPS service with visible attribution. There is no API key requirement for that default.

- Loading the map does not request device location. With no selected pin, the map centers on Varanasi solely for orientation and displays no destination marker.
- **Use my current location** invokes `navigator.geolocation.getCurrentPosition` after the user's click. The browser enforces permission. Requests ask for high accuracy, use a 15-second timeout and do not reuse a cached reading.
- The UI reports available accuracy and asks the user to verify their entrance. Permission denied, unavailable location, insecure context and timeout each provide a useful error and alternatives.
- A tap/click selects the destination; the destination marker can be dragged. Typed latitude/longitude fields offer a keyboard-accessible fallback without tiles or GPS. Blank, non-finite and out-of-range values are rejected; latitude must be -90..90 and longitude -180..180. Zero is a valid coordinate.
- A manual change takes precedence over an older pending GPS response. GPS does not run continuously or in the background.
- The written address must still be completed. No geocoding, reverse geocoding, street search or automatic address filling is implemented.
- Tile loading has a visible loading state, failure timeout, offline message and retry. Selected coordinates remain available if tiles fail. There is no offline tile download or prefetch feature.

OpenStreetMap tiles are a shared, best-effort service without an availability SLA. Configure another provider when the deployment's traffic/support needs require it. Keep attribution visible and browser caching/referrer behavior compatible with the [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/). The integration follows the [Leaflet API](https://leafletjs.com/reference.html).

## API routes used by the storefront

All paths below are relative to the configured API base, normally `/v1`. These routes were checked against the standalone backend controllers.

| Method and path                           | Purpose                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------- |
| `GET /auth/csrf`                          | Bootstrap a cookie-backed guest/customer session and obtain CSRF protection.          |
| `GET /auth/session`                       | Read the current session.                                                             |
| `POST /auth/otp/request`                  | Request sign-in verification for an Indian mobile number.                             |
| `POST /auth/otp/verify`                   | Verify the challenge and rotate into the signed-in session.                           |
| `POST /auth/logout`                       | End the session and clear visible account data.                                       |
| `GET /addresses`                          | List active addresses owned by the signed-in user.                                    |
| `POST /addresses`                         | Save a complete address and coordinates; the first active address becomes default.    |
| `PATCH /addresses/:addressId`             | Edit an owned address and validate the complete merged result.                        |
| `DELETE /addresses/:addressId`            | Soft-delete an owned address, selecting another default if needed.                    |
| `POST /addresses/:addressId/default`      | Set an owned address as default using an empty `{}` body.                             |
| `POST /serviceability/check`              | Validate the PIN and obtain current slots/COD eligibility.                            |
| `POST /checkout/quotes`                   | Calculate a server quote, including an immutable delivery snapshot.                   |
| `POST /orders`                            | Create an order from `quoteId`/`version`, with an `Idempotency-Key`.                  |
| `GET /orders`                             | List this account/session's orders using cursor pagination.                           |
| `GET /orders/:orderId`                    | Read an accessible order and its snapshot.                                            |
| `POST /orders/:orderId/payment-sessions`  | Create/retrieve a payment attempt using an idempotency key.                           |
| `POST /orders/:orderId/payments/simulate` | Complete the configured local fake-payment flow.                                      |
| `GET /orders/:orderId/tracking`           | Read current status, history, destination, estimate and nullable rider location.      |
| `POST /guest-order-access/request`        | Request an order-specific verification challenge for a guest on a new device/session. |
| `POST /guest-order-access/verify`         | Grant temporary access to that guest order after verification.                        |

The frontend sends credentials with requests, retains CSRF only in memory, validates response schemas, and uses request cancellation/timeouts. Unsafe requests send `X-CSRF-Token`. No caller-supplied user ID can choose ownership. Address create/edit payloads use `name`, `phone`, `line`, `locality`, `city`, `state`, `pin`, `landmark`, `instructions`, `latitude` and `longitude`.

The backend also supports `addressId` instead of an inline `address` for quotes. The current checkout sends the selected address's complete edited value inline so unsaved pin/address changes are included in the quote. The order receives `quoteId` and `version`, not a client-selected total or a newly substituted address. Editing fields invalidates the displayed quote; changing the PIN requires another delivery availability check. Failed order creation and payment-session retries retain their respective idempotency keys, and the form locks after an order has been saved.

## Persistence and tracking model changes

Migration `C:\Dev\plant-backend\prisma\migrations\202609230001_delivery_addresses\migration.sql`:

- Adds `Address.isDefault` and nullable `Address.deletedAt`.
- Backfills one default per existing user.
- Adds a partial unique index enforcing one active default per user, a user/deletion index, and a constraint preventing a deleted row from remaining default.

Human-readable address fields and coordinates remain additive properties inside existing `Address.value` JSON. Orders retain them in `Order.snapshot.input.address`, via their quote snapshot. Old JSON data is preserved. Changing/removing a saved address cannot redirect an already quoted or ordered delivery.

The existing order status and rider-assignment architecture is reused:

| Backend state      | Customer label   |
| ------------------ | ---------------- |
| `confirmed`        | Order placed     |
| `preparing`        | Processing       |
| `out_for_delivery` | Out for delivery |
| `delivered`        | Delivered        |

Awaiting payment, cancellation and expiry remain separate states. Tracking's `estimatedDelivery` is the booked slot's start time, not a calculated driver ETA. Times are presented in India Standard Time.

The tracking page polls every 15 seconds while visible, supports manual refresh, cancels requests when hidden/unmounted, and stops scheduled polling after delivered/cancelled/expired. An inaccessible order clears its prior displayed data. Temporary connection failures retain previously loaded information with an error and last-checked time; they do not invent newer information.

The destination pin comes from the immutable order address. A rider marker is shown only for an out-for-delivery order with accepted actual device coordinates; simulated positions are excluded. Actual old readings are labelled **last known**, including the recorded timestamp, reported accuracy and stale status. The backend computes freshness on each read. Completed deliveries no longer expose the rider marker.

The existing staff/rider APIs are the integration point for a future rider app:

- `POST /v1/admin/orders/:orderId/prepare` with `{}` and an idempotency key.
- `POST /v1/admin/orders/:orderId/rider-assignment` with `riderId`.
- `GET /v1/rider/assignments` returns the assigned order destination and device session.
- `POST /v1/rider/orders/:orderId/delivery-events` changes to `out_for_delivery` or `delivered`, with an idempotency key.
- `POST /v1/rider/orders/:orderId/locations` submits `latitude`, `longitude`, `accuracy`, `recordedAt`, incrementing `sequence` and the current `deviceSession`.

Only the assigned delivery-agent role may submit location for an active delivery. Reassignment rotates the device session and clears the prior rider location. Updates validate coordinate range, accuracy, timestamp and sequence. `TRACKING_PROVIDER=local` records samples as simulation. `TRACKING_PROVIDER=device` marks accepted device samples as actual; changing this setting does not generate GPS samples and does not convert historical simulation into actual data.

There is no rider mobile app or background GPS collection in this change. The future rider client must obtain its own device permission and send genuine samples. The customer browser's **Use my current location** sets the delivery destination only; it never represents the delivery agent.

## Main frontend files

Paths in this table are relative to `C:\Dev\plant-ecommerce`.

| Files                                                                                                 | Responsibility                                                                                              |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/features/delivery/api.ts`, `contracts.ts`                                                        | Backend mode selection, HTTP/session/CSRF transport and validated delivery contracts.                       |
| `src/features/delivery/address-fields.tsx`, `address-book.tsx`, `session-panel.tsx`                   | Shared address form, address book/default controls and OTP session UI.                                      |
| `src/features/delivery/location-map.tsx`, `map-canvas.tsx`, `location-picker.tsx`, `delivery-map.css` | Responsive Leaflet map, location permission, pin selection and manual fallback.                             |
| `src/features/checkout/checkout.tsx`, `api-checkout.tsx`, `demo-checkout.tsx`, `payment.tsx`          | Mode selection, backend quote/order/payment flow and preserved local demonstration.                         |
| `src/features/content/account.tsx`                                                                    | Account/address routing to the new session/address components.                                              |
| `src/features/orders/api-tracking.tsx`, `delivery-destination.tsx`, `views.tsx`                       | Backend order list/lookup, guest recovery, status polling and readable/map destinations; legacy demo views. |
| `src/app/track-order/page.tsx`                                                                        | Static-compatible tracking query route with Suspense.                                                       |
| `src/contracts/index.ts`, `src/app/globals.css`                                                       | Backward-compatible demo order address and shared responsive form styling.                                  |
| `.env.example`, `package.json`, `pnpm-lock.yaml`                                                      | Public API/map configuration and Leaflet dependency.                                                        |

Existing entry pages remain `/account`, `/account/addresses`, `/checkout`, `/account/orders` and `/track-order`. Backend orders use `/track-order?orderId=<uuid>` so new server-generated IDs work with the existing static export. Existing `/track-order/KG-...` demo routes remain demonstrations; they are not backend order identifiers.

Other frontend changes include `src/components/layout/shell.tsx` for mode-aware navigation/notices, `scripts/serve.mjs` for a configurable local preview port, and delivery/map/tracking test suites under `tests/integration` and `tests/e2e`. The obsolete illustrated `src/features/orders/map.tsx` was removed.

## Backend files changed

Paths below are relative to `C:\Dev\plant-backend`:

- Validation and registration: `src/common/address.ts` (new), `src/common/dtos.ts`, `src/common/openapi-contracts.ts`, `src/app.module.ts`, `src/config/environment.ts`.
- Services/controllers: `src/modules/addresses/addresses.service.ts` (new), `src/modules/addresses/account.controller.ts`, `src/modules/checkout/checkout.service.ts`, `src/modules/orders/order.persistence.ts`, `src/modules/tracking/tracking.service.ts`.
- Persistence: `prisma/schema.prisma`, `prisma/migrations/202609230001_delivery_addresses/migration.sql` (new).
- Tests: `test/unit/delivery.spec.ts` (new), `test/integration/commerce.spec.ts`.
- Contracts: `contracts/domain.ts`, regenerated `contracts/openapi.json`, `contracts/api.d.ts` and `src/generated/prisma/`.
- Configuration/documentation: `.env.example`, `README.md`, `docs/delivery-location.md` (new), `docs/frontend-compatibility.md`, `docs/verification.md`, `docs/requests.http`.

No backend dependency or actual `.env` value was changed.

## Manual end-to-end verification

Use fictional recipient details with the local database and fake providers.

1. Complete the setup above, run API/worker/frontend and enable `NEXT_PUBLIC_API_BASE_URL`. Check that API startup is healthy and the seeded catalog and future delivery slots exist.
2. Open `/account/addresses`. Request a code for a synthetic ten-digit Indian mobile. With `MESSAGING_PROVIDER=local`, no SMS is sent. Read only this challenge's code from the backend terminal using `pnpm dev:otp <challengeId>`, then verify in the browser.
3. Add an address with a complete written address and a seeded serviceable PIN (`221001` or `221005` for COD; `221010` is prepaid only). Try saving without a pin or city and confirm validation prevents submission.
4. Press **Load map**. Check that loading it does not ask for location permission and has no selected default marker. Click the entrance to select a pin, then drag it. Alternatively enter coordinates manually. Confirm that saved coordinates and the visible pin agree.
5. Separately test **Use my current location**: deny permission and confirm map/manual entry remain usable; allow it and inspect the reported accuracy, then adjust the pin. Test with tile requests blocked/offline and confirm written/manual fields remain usable. Do not use an automatically detected location unless it is the intended delivery destination.
6. Save, reload and verify the backend address is retained. Add a second address, change the default, edit its pin and remove it. Verify another signed-in account cannot view or mutate the first account's addresses.
7. Add a matching seeded product to the cart and open `/checkout`. Confirm the default address loads. Select another address or edit the details/pin. Use **Save address changes** if the address book should retain those changes; otherwise checkout still snapshots the edited value.
8. Check delivery availability, select a returned slot and use COD for a simple order. Review the server total. Change the PIN and confirm the previous quote disappears and delivery must be checked again. Review again, confirm once, and verify navigation to `/track-order?orderId=<uuid>`.
9. Verify order status, written address, destination coordinates and map pin agree with checkout. Reload the tracking page. Edit/delete the saved address in the address book and confirm the existing order destination is unchanged.
10. Repeat with UPI/card using `PAYMENT_PROVIDER=fake` and the worker. Complete a simulated payment or retry a temporarily unprepared session. Verify retries use the already-created order and only a successful payment/COD confirmation clears the cart. Hosted real payment checkout is not enabled by this UI change.
11. Verify `/account/orders` links to the new order. From a different session, try a guest order: access should be denied until signing in appropriately or completing the order-specific recovery challenge at `/track-order` using the original order ID and checkout mobile.
12. Using separately provisioned admin/rider accounts and the backend Swagger/API, prepare the order, assign a rider and dispatch it. Confirm the status updates while the customer tracking page is visible. Without a submitted actual rider sample, there must be no rider marker.
13. For a device integration test, set backend `TRACKING_PROVIDER=device`, restart it, and have the assigned authorized device submit genuine GPS with its current device session and increasing sequence. Confirm marker coordinates, timestamps and accuracy match that submission; the marker must remain still until another accepted sample arrives. Wait beyond the configured freshness interval and confirm the last-known/stale notice. Deliver the order and confirm the rider marker disappears and polling stops.
14. Open an older order without coordinates: its status and written address should still render, with a missing-pin message. Test narrow mobile and desktop widths, keyboard form navigation, validation, map controls, and loading/error states.

## Automated checks and remaining limits

Frontend integration tests cover explicit location permission, manual coordinate ranges, late GPS response handling, real-coordinate map markers, tile failures/retry, checkout validation/quote snapshots, order/payment retry keys, address CRUD/defaults, session privacy, API response validation and tracking behavior. Tests with mocked APIs/Leaflet verify the client contracts and failure handling; they do not prove PostgreSQL persistence, device GPS quality, SMS delivery or a live map provider's availability.

Run frontend lint, types, build, unit and integration tests:

```powershell
Set-Location 'C:\Dev\plant-ecommerce'
npx --yes pnpm@10.17.1 format:check
npx --yes pnpm@10.17.1 lint
npx --yes pnpm@10.17.1 typecheck
npx --yes pnpm@10.17.1 build
npx --yes pnpm@10.17.1 test:unit
npx --yes pnpm@10.17.1 test:integration
```

The existing Playwright storefront suite runs against a separately started frontend server; use empty `NEXT_PUBLIC_API_BASE_URL` for its demo-checkout regression scenarios. Backend lint, type-check, build, unit and PostgreSQL integration commands are documented in the backend README. Database integration tests require an isolated migrated `TEST_DATABASE_URL` whose database name ends `_test` and a real Redis URL; do not use shared/customer data.

The API-mode browser suite uses HTTP fixtures and the real Leaflet canvas. Run it with an API-mode production build in a separate terminal:

```powershell
$env:NEXT_PUBLIC_API_BASE_URL='http://localhost:4000/v1'
pnpm build
$env:PORT='3012'
node scripts/serve.mjs
```

In the test terminal:

```powershell
$env:BASE_URL='http://127.0.0.1:3012'
$env:DELIVERY_API_E2E='1'
pnpm exec playwright test tests/e2e/delivery.spec.ts
```

The default preview port remains 3001; `PORT` can avoid another app's listener. Browser fixtures deliberately block tile requests to verify the outage fallback while exercising real map pin selection. Geolocation success uses browser-granted test coordinates; denial uses a browser API stub. These are test fixtures, never rider data shipped in the application.

Verification on 23 September 2026: frontend lint/type-check and production builds passed in demo and API modes; 69 frontend unit/integration tests and 12 desktop/mobile browser checks passed (8 demo regressions and 4 API-mode checks). Backend lint/type-check/build, OpenAPI generation, formatting and 51 unit tests passed. PostgreSQL/Redis were unavailable, so the migration was not applied and database integration tests could not complete. The persisted end-to-end flow still requires the services and setup above.

True live driver GPS requires a rider application/device integration. Address/pin matching is checked by the customer, with PIN serviceability enforced by the existing backend zones; there is no reverse geocoding or new geofence policy. The catalog remains a seeded demonstration, and payment/SMS/storage production integrations retain their existing limitations. The backend intentionally rejects production/live-payment startup until its launch requirements are completed. Supplying dummy URLs or keys alone cannot enable those services.
