# Architecture and implementation scope

Next.js App Router prerenders immutable content, product detail routes and guide routes. Static export was chosen so the frontend deploys without a business backend. Interactive islands handle cart, filters, forms, demo account/order state and optional dialogs. Root app layout is a Server Component. No commerce route handlers or server mutations exist.

The cart uses a reducer/context. Local storage is treated as untrusted and parsed with Zod. Quantity operations enforce stock and a maximum of ten. Currency is integer paise. Contact/address forms do not persist customer input. Checkout uses React Hook Form plus Zod. Simulated payment has explicit success, pending, failure and dismissal outcomes. Pending/failure leave the cart intact; successful prepaid/COD clears it. The separate backend must become the source of truth for a live integration.

The small demo catalog is available to client filters and cart reconciliation. This is an intentional static-demo simplification, not the proposed scalable catalog integration. SearchService demonstrates an abortable typed adapter. The full service-interface decomposition in the reference brief is not yet implemented. Catalog size/light/care data and photos are illustrative, not verified botanical guidance.

## Remaining advanced brief items

- Replace illustrative asset reuse with exact product/variant photography and supplier-approved care data.
- Move catalog pagination/filtering to a paginated adapter rather than shipping 24 demo records to the browser. Add size and planter filtering, debounced suggestions and comprehensive invalid-filter errors.
- Expand mock service contracts, quote versions/expiry, stock/price-change recovery, slot expiry, timeout scenarios, per-feature error boundaries and account/address editing.
- Tracking is a static, dated simulation with an optional lazy illustrative panel. It does not poll, move a rider, or implement visibility/staleness sequencing.
- Account sign-in is only a UI state; there is no authorization. The account detail screen demonstrates a signed-out guard. Tracking IDs are public demo fixtures.
- New order routes are statically prebuilt for KG-DEMO-001 through KG-DEMO-020. The sample order survives reload; new orders do not. This is a bounded demonstration.
- Coverage targets from the master brief, field performance targets, complete WCAG conformance, bundle-trigger network assertions and all failure scenarios are not claimed as achieved.
- No Google Maps renderer is supplied. No optional key is necessary.
- Sitemap intentionally contains no synthetic URLs. Future real deployment needs approved canonicals, structured offers and business facts, legal terms and search-engine submission.

The shipped UI is English. Messages can be extracted into a translation dictionary for Hindi; no nonfunctional toggle is displayed.

WebMCP: a feature-detected, read-only `read_demo_shopping_bag` tool exposes the same current cart IDs/variants/quantities and rejects nonempty input. Unsupported browsers are unaffected. A native supported WebMCP context was unavailable, so end-to-end WebMCP validation is not claimed.

## Frontend feature pattern

Keep routes in `src/app` responsible for metadata, static parameters, and composing feature components. Keep server pages and the root layout as Server Components; add client boundaries only where interaction is needed.

Within each feature, separate three responsibilities:

- **Plain TypeScript logic:** deterministic rules without React or browser state. `catalog/query.ts` parses URL filters and selects/sorts/paginates supplied products. `cart/reducer.ts` owns cart transitions, reusing the existing mock product lookup and stock limits.
- **Hooks and providers:** connect those rules to external state. `catalog/use-catalog.ts` adapts Next.js navigation; the URL remains the source of truth for filters. `cart/store.tsx` handles context, hydration, and persistence.
- **UI components:** render values and invoke typed callbacks. `catalog/catalog-filters.tsx` has no routing dependency; `catalog/catalog.tsx` composes the hook, filters, and existing product cards for Shop, Search, and Collections.

Keep feature-specific code together. Promote a component to `components/ui` only when it is shared across features. Reuse contracts from `contracts` and existing service adapters. Do not introduce generic repositories, new state libraries, or barrel exports just to add layers. Existing mock and delivery API behavior remains unchanged by this refactor.

Test plain logic with unit tests and the routing adapter with integration tests. New catalog filters belong in the query type/parser/selector, then the filter UI; they should not require duplicating filtering logic in route pages.
