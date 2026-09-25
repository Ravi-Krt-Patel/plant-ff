import { z } from "zod";
import type { RouteModule } from "./shared";
import { result, params, idempotencyKey, unavailableProvider } from "./shared";
import { quoteInputSchema, orderInputSchema, pageSchema } from "../contracts";
import { page } from "../domain/shared";
export const commerceRoutes: RouteModule = (app, c) => {
  for (const path of ["/checkout/quote", "/checkout/quotes"])
    app.post(
      path,
      { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
      async (req, reply) => {
        const session = await c.sessions.require(req);
        return result(
          req,
          reply,
          await c.commerce.createQuote(
            session.id,
            quoteInputSchema.parse(req.body),
          ),
          201,
        );
      },
    );
  app.post(
    "/orders",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const session = await c.sessions.require(req);
      return result(
        req,
        reply,
        await c.commerce.createOrder(
          session.id,
          orderInputSchema.parse(req.body),
          idempotencyKey(req),
        ),
        201,
      );
    },
  );
  app.get("/orders", async (req, reply) => {
    const session = await c.sessions.require(req);
    const q = pageSchema.strict().parse(req.query);
    await c.commerce.sweep();
    return result(
      req,
      reply,
      await c.repo.read((s) =>
        page(
          [...s.orders.values()]
            .filter((o) => o.ownerId === session.id)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
          q.page,
          q.limit,
        ),
      ),
    );
  });
  app.get("/orders/:id", async (req, reply) => {
    const session = await c.sessions.require(req);
    return result(
      req,
      reply,
      await c.commerce.getOrder(session.id, params(req).id!),
    );
  });
  app.post("/orders/:id/payment-sessions", async (req, reply) => {
    const session = await c.sessions.require(req);
    z.object({})
      .strict()
      .parse(req.body ?? {});
    return result(
      req,
      reply,
      await c.commerce.paymentSession(
        session.id,
        params(req).id!,
        idempotencyKey(req),
      ),
      201,
    );
  });
  app.get("/orders/:id/payment-status", async (req, reply) => {
    const session = await c.sessions.require(req);
    const order = await c.commerce.getOrder(session.id, params(req).id!);
    return result(req, reply, {
      orderId: order.id,
      paymentStatus: order.paymentStatus,
      fulfillment: order.fulfillment,
      version: order.version,
      demo: true,
    });
  });
  app.post("/payments/demo/:id/simulate", async (req, reply) => {
    const session = await c.sessions.require(req);
    const { outcome } = z
      .object({
        outcome: z.enum([
          "success",
          "pending",
          "failure",
          "dismissed",
          "timeout",
        ]),
      })
      .strict()
      .parse(req.body);
    return result(
      req,
      reply,
      await c.commerce.simulate(session.id, params(req).id!, outcome),
    );
  });
  app.post("/orders/:id/cancellation-requests", async (req, reply) => {
    const session = await c.sessions.require(req);
    const { reason } = z
      .object({ reason: z.string().trim().min(3).max(500) })
      .strict()
      .parse(req.body);
    return result(
      req,
      reply,
      await c.commerce.cancel(
        session.id,
        params(req).id!,
        reason,
        idempotencyKey(req),
      ),
    );
  });
  app.get("/orders/:id/tracking", async (req, reply) => {
    const session = await c.sessions.require(req);
    return result(
      req,
      reply,
      await c.commerce.tracking(session.id, params(req).id!),
    );
  });
  app.post("/orders/:id/guest-access", async (req, reply) => {
    const session = await c.sessions.require(req);
    return result(
      req,
      reply,
      await c.commerce.accessToken(session.id, params(req).id!),
      201,
    );
  });
  app.post(
    "/orders/lookup",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const input = z
        .object({
          orderId: z.string().max(100),
          accessToken: z.string().min(32).max(100),
        })
        .strict()
        .parse(req.body);
      return result(
        req,
        reply,
        await c.commerce.lookup(input.orderId, input.accessToken),
      );
    },
  );
  app.post("/payments/razorpay/create-order", async (req) => {
    await c.sessions.require(req);
    return unavailableProvider();
  });
  app.post("/payments/razorpay/verify", async (req) => {
    await c.sessions.require(req);
    return unavailableProvider();
  });
  app.post("/webhooks/razorpay", async () => unavailableProvider());
};
