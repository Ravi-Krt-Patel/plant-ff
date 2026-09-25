# Database and production handoff

No database driver, ORM, schema migration, database URL, or hosted resource has been added. All state lives in one MemoryRepository instance owned by the API server. The frontend is still independently runnable and unchanged.

Before enabling real users or money:

1. Add persistent repositories for products/variants, inventory and reservations, dated delivery slots, customers/sessions, addresses, quotes/lines, orders/lines, payment attempts/provider mappings, webhook events, idempotency records, cancellations/refunds, and tracking snapshots.
2. Implement transactional pricing/version checks, conditional inventory decrements and slot capacity constraints with concurrency-safe locks. Unique constraints must protect quote consumption, scoped idempotency keys, provider payment IDs and webhook event IDs. Do not implement a database adapter by blindly persisting a whole map snapshot per request.
3. Add a durable reservation-expiry worker and provider reconciliation worker. Crash/restart must not lose reservations, captured payments, pending orders, webhook deduplication or refunds. Build recovery and backup/migration tests.
4. Replace demo sign-in with a chosen identity/OTP provider, verify phone ownership as required, bind sessions to durable identities and add session revocation/rotation, account linking and recovery. The current guest capability is order-scoped but transient; agree the production recovery and expiry policy.
5. Configure a real merchant adapter. Verify checkout signatures against the STORED provider order ID, independently verify raw-body webhook HMAC, fetch provider payment state, and verify association, captured status, amount and currency before confirming payment. Treat duplicate/out-of-order events and late capture after cancellation/reservation expiry as durable reconciliation/refund cases. Refund requests are not settled refunds.
6. Implement actual signed Razorpay webhook ingestion, durable deduplication, reconciliation and controlled refunds. The current Razorpay endpoints intentionally return 503; no signature/webhook implementation is falsely labelled production-ready.
7. Supply approved product care data, exact images, delivery areas/cutoffs/slot capacities/COD policy/tax treatment/contact/legal content. Current sample values must not silently become production business rules.
8. Enable HTTPS and Secure cookies, agree same-site hosting/proxy strategy and CSRF/CORS policy, configure trusted proxy hops and shared rate limiting, set privacy retention policies, and test authorization across every resource.
9. Connect a trusted courier/rider feed with authorization and bounded coordinate retention. The current synthetic operations endpoint is only a test tool. Retain text-only tracking if no coordinates are available.
10. Replace memory/demo mode with explicit provider/storage configuration and remove or disable demo simulation endpoints. Add monitored deployment, backups, production smoke checks and alerting without PII in logs. Do not publish this memory service as a live payment backend.

Official implementation references consulted: [Fastify testing](https://fastify.dev/docs/latest/Guides/Testing/), [Fastify cookies](https://github.com/fastify/fastify-cookie), [Razorpay server integration](https://razorpay.com/docs/payments/server-integration/nodejs/integration-steps/). Provider verification and persistence work is deferred, not claimed complete.
