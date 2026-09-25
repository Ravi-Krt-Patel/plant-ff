import { z } from "zod";
import type { RouteModule } from "./shared";
import { params, result } from "./shared";
import { ApiError, requireValue } from "../errors";
import { sameSecret, iso } from "../domain/shared";
export const operationsRoutes: RouteModule = (app, c) => {
  app.addHook("preHandler", async (req) => {
    const expected = c.config.operationsToken;
    const provided = req.headers.authorization?.replace(/^Bearer /, "");
    if (!expected)
      throw new ApiError(
        503,
        "operations_disabled",
        "Set a server-only operations token to enable demo operations",
      );
    if (!provided || !sameSecret(provided, expected))
      throw new ApiError(
        401,
        "unauthorized",
        "Operations authorization required",
      );
  });
  app.patch("/products/:id", async (req, reply) => {
    const input = z
      .object({
        stock: z.number().int().min(0).max(10000).optional(),
        pricePaise: z.number().int().min(100).max(10000000).optional(),
      })
      .strict()
      .refine((v) => Object.keys(v).length > 0)
      .parse(req.body);
    return result(
      req,
      reply,
      await c.repo.transaction((s) => {
        const p = requireValue(
          s.products.get(params(req).id!),
          "Product not found",
        );
        if (input.stock !== undefined) p.stock = input.stock;
        if (input.pricePaise !== undefined) {
          p.pricePaise = input.pricePaise;
          p.variants = p.variants.map((v) => ({
            ...v,
            pricePaise: input.pricePaise! + (v.id === "ceramic" ? 20000 : 0),
          }));
        }
        p.version++;
        return p;
      }),
    );
  });
  app.patch("/orders/:id/fulfillment", async (req, reply) => {
    const { status } = z
      .object({
        status: z.enum(["preparing", "out_for_delivery", "delivered"]),
      })
      .strict()
      .parse(req.body);
    return result(
      req,
      reply,
      await c.commerce.transition(params(req).id!, status),
    );
  });
  app.post("/orders/:id/tracking", async (req, reply) => {
    const input = z
      .object({
        sequence: z.number().int().positive(),
        recordedAt: z.iso.datetime(),
        coordinates: z
          .object({
            latitude: z.number().min(-90).max(90),
            longitude: z.number().min(-180).max(180),
            accuracyMeters: z.number().nonnegative(),
            heading: z.number().min(0).max(360).optional(),
          })
          .strict()
          .optional(),
        estimatedArrival: z.iso.datetime().nullable().default(null),
      })
      .strict()
      .parse(req.body);
    return result(
      req,
      reply,
      await c.repo.transaction((s) => {
        const o = requireValue(s.orders.get(params(req).id!));
        if (o.fulfillment !== "out_for_delivery")
          throw new ApiError(
            409,
            "tracking_unavailable",
            "Locations are accepted only during active delivery",
          );
        if (
          input.sequence <= (o.tracking?.sequence ?? 0) ||
          Date.parse(input.recordedAt) <
            Date.parse(o.tracking?.recordedAt ?? o.createdAt) ||
          Date.parse(input.recordedAt) > c.now() + 30000
        )
          throw new ApiError(
            409,
            "stale_update",
            "Tracking sequence or timestamp is invalid",
          );
        o.tracking = { ...input, receivedAt: iso(c.now()) };
        return { accepted: true, sequence: input.sequence, demo: true };
      }),
    );
  });
  app.post("/orders/:id/collect-cod", async (req, reply) =>
    result(
      req,
      reply,
      await c.repo.transaction((s) => {
        const o = requireValue(s.orders.get(params(req).id!));
        if (o.method !== "cod" || o.fulfillment !== "delivered")
          throw new ApiError(
            409,
            "collection_unavailable",
            "Demo COD collection requires a delivered COD order",
          );
        o.paymentStatus = "captured";
        o.updatedAt = iso(c.now());
        return { orderId: o.id, paymentStatus: o.paymentStatus, demo: true };
      }),
    ),
  );
  app.post("/orders/:id/refund-completed", async (req, reply) =>
    result(
      req,
      reply,
      await c.repo.transaction((s) => {
        const o = requireValue(s.orders.get(params(req).id!));
        if (
          !["refund_requested", "reconciliation_required", "refunded"].includes(
            o.paymentStatus,
          )
        )
          throw new ApiError(
            409,
            "refund_unavailable",
            "No refund or reconciliation case exists",
          );
        o.paymentStatus = "refunded";
        o.updatedAt = iso(c.now());
        o.version++;
        return { orderId: o.id, paymentStatus: o.paymentStatus, demo: true };
      }),
    ),
  );
};
