# Lazy-loading and verification

| Feature            | Trigger                         | Boundary                      | Before loading                                 |
| ------------------ | ------------------------------- | ----------------------------- | ---------------------------------------------- |
| Product zoom       | Enlarge image button            | next/dynamic catalog/zoom     | Normal image, product and buy controls present |
| Payment simulation | Valid checkout with UPI/card    | next/dynamic checkout/payment | Form, order summary and COD path ready         |
| Illustrative map   | Show tracking map               | next/dynamic orders/map       | Timeline and order summary available           |
| Offscreen photos   | Native image viewport threshold | next/image loading=lazy       | Fixed aspect ratio reserves space              |
| Route content      | Link navigation                 | Next route chunks             | Prerendered product/guide HTML                 |

Hero/detail images are immediate and priority-loaded. No payment provider or Google Maps scripts exist. The optional features mount only after their button action. Radix dialogs manage keyboard focus and dismissal. Route error/loading/not-found boundaries provide recovery. There is no claim of isolated lazy-chunk error recovery beyond route recovery.

Measured locally with Node 22.22.0 on Windows: initial production build contained 28 JavaScript chunks, 1,204,237 bytes uncompressed across all routes. This is NOT initial-load JS or an LCP/INP measure. `pnpm analyze` checks a 2.5 MB all-routes regression budget and verifies product text/noindex in generated HTML. No throttled Lighthouse or field performance data collected. LCP <=2.5s, INP <=200ms and CLS <=0.1 remain targets.

Playwright covers zoom activation, timeline without the map, map activation, desktop/mobile shopping, reload persistence, COD and failed prepaid recovery. Comprehensive network chunk-trigger assertions remain future work. Manual keyboard checks: tab through navigation, product choices and checkout; open/close zoom/payment with keyboard; confirm focus is visible and returned; inspect at 200% zoom and 360px width.
