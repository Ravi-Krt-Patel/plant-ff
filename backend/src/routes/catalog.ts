import { z } from "zod";
import type { RouteModule } from "./shared";
import { result, params } from "./shared";
import { categories, guides } from "../fixtures";
import { requireValue } from "../errors";
import { serviceability } from "../domain/delivery";
import { expireReservations } from "../domain/shared";
export const catalogRoutes: RouteModule = (app, c) => {
  app.get("/health", async (req, reply) =>
    result(req, reply, {
      status: "ok",
      service: "kashi-greens-api",
      database: "not-connected",
      demo: true,
    }),
  );
  app.get("/products", async (req, reply) => {
    await c.commerce.sweep();
    return result(req, reply, await c.catalog.list(req.query));
  });
  app.get("/products/:slug", async (req, reply) => {
    await c.commerce.sweep();
    return result(req, reply, await c.catalog.get(params(req).slug!));
  });
  app.get("/search", async (req, reply) => {
    await c.commerce.sweep();
    return result(req, reply, await c.catalog.list(req.query));
  });
  app.get("/categories", async (req, reply) => result(req, reply, categories));
  app.get("/collections/:slug", async (req, reply) =>
    result(
      req,
      reply,
      await c.catalog.list({
        ...z.record(z.string(), z.unknown()).parse(req.query),
        category: params(req).slug,
      }),
    ),
  );
  app.get("/plant-care", async (req, reply) => result(req, reply, guides));
  app.get("/plant-care/:slug", async (req, reply) =>
    result(
      req,
      reply,
      requireValue(
        guides.find((g) => g.slug === params(req).slug),
        "Guide not found",
      ),
    ),
  );
  app.get("/store/config", async (req, reply) =>
    result(req, reply, {
      brand: "Kashi Greens",
      currency: "INR",
      timezone: "Asia/Kolkata",
      demo: true,
      shippingPaise: 4900,
      codMaxPaise: 200000,
      taxPaise: 0,
      quoteTtlSeconds: c.config.quoteTtlMs / 1000,
      reservationTtlSeconds: c.config.reservationTtlMs / 1000,
      contact: null,
      policiesStatus: "draft",
      paymentMethods: ["upi", "card", "cod"],
      realPaymentsEnabled: false,
    }),
  );
  app.post(
    "/serviceability/check",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const { pin } = z
        .object({ pin: z.string().regex(/^\d{6}$/) })
        .strict()
        .parse(req.body);
      return result(
        req,
        reply,
        await c.repo.transaction((s) => {
          expireReservations(s, c.now());
          return serviceability(s, pin, c.now());
        }),
      );
    },
  );
};
