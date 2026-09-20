# Kashi Greens

A mobile-responsive, frontend-only concept plant storefront for Varanasi. All products, orders, payments, service areas and accounts are demonstrations.

## Run

Node 22.22.0 or newer supported Node LTS; pnpm 10.17.1.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3000. Build with `pnpm build`. The static export is in `out/`; use `node scripts/serve.mjs` to preview it at http://localhost:3001. The exact dependency tree is recorded in pnpm-lock.yaml. Framework: Next.js 16.3.5, React 19.3.0, strict TypeScript 5.9.3, Tailwind 4.3.3. UI dialogs use Radix primitives.

## Included

24 deterministic sample products; home, catalog, collection, search, product, wishlist, variant-aware cart, validated guest checkout, sample coupon, simulated prepaid/COD outcomes, account, sample address book, order history, tracking, guides, contact, FAQ and draft policies. Responsive at 360px upwards. Catalog URL filters, sorting and pagination. Product content is rendered into HTML. Persistent demo notice and noindex everywhere; robots disallows crawling and sitemap is intentionally empty.

Use PIN 221001 or 221005 for demo COD; 221010 is prepaid-only. Use GROW10 for a sample discount. The checkout offers a fictional address autofill. KG-SAMPLE-001 is the seeded direct-link order.

Only versioned cart IDs/variants/quantities and wishlist IDs persist. User-entered details, account state, addresses and new orders remain in memory. Reload resets those. Footer Reset demo clears saved selections. There are no business API routes, real login, payment SDKs, transaction handling, live maps or backend dependencies.

## Checks

`pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test:unit`, `pnpm test:integration`, `pnpm build`, `pnpm analyze`.

Run the production preview and `BASE_URL=http://localhost:3001 pnpm test:e2e` (PowerShell: `$env:BASE_URL='http://localhost:3001'`). Playwright uses installed Chrome by default. CI installs Chromium and selects it via PLAYWRIGHT_CI=1.

## Scope and handoff

The supplied master brief is broader than this frontend implementation. See docs/architecture.md for the precise implemented scope and remaining integrations. This is not a production commerce, authentication, tracking, or payment system. No real merchant details or legal policies have been invented.
