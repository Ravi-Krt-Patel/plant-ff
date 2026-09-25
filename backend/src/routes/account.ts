import { z } from "zod";
import type { RouteModule } from "./shared";
import { result, unavailableProvider, params } from "./shared";
import { COOKIE } from "../domain/sessions";
import { addressSchema, lineSchema } from "../contracts";
import { ApiError, requireValue } from "../errors";
import { makeId, iso } from "../domain/shared";
export const accountRoutes: RouteModule = (app, c) => {
  app.post(
    "/auth/guest",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req, reply) => {
      z.object({})
        .strict()
        .parse(req.body ?? {});
      if (req.cookies[COOKIE]) await c.sessions.require(req);
      return result(
        req,
        reply,
        await c.sessions.start(reply, req.cookies[COOKIE]),
        201,
      );
    },
  );
  app.post(
    "/auth/demo-sign-in",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req, reply) => {
      z.object({})
        .strict()
        .parse(req.body ?? {});
      if (req.cookies[COOKIE]) await c.sessions.require(req);
      return result(
        req,
        reply,
        await c.sessions.start(reply, req.cookies[COOKIE], "demo_customer"),
        201,
      );
    },
  );
  app.get("/auth/session", async (req, reply) =>
    result(req, reply, await c.sessions.require(req)),
  );
  app.post("/auth/sign-out", async (req, reply) =>
    result(req, reply, await c.sessions.logout(req, reply)),
  );
  app.post(
    "/auth/otp/request",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async () => unavailableProvider(),
  );
  app.post(
    "/auth/otp/verify",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async () => unavailableProvider(),
  );
  app.get("/addresses", async (req, reply) => {
    const owner = await c.sessions.require(req, true);
    return result(
      req,
      reply,
      await c.repo.read((s) =>
        [...s.addresses.values()].filter((a) => a.ownerId === owner.id),
      ),
    );
  });
  app.post("/addresses", async (req, reply) => {
    const owner = await c.sessions.require(req, true);
    const input = addressSchema.parse(req.body);
    return result(
      req,
      reply,
      await c.repo.transaction((s) => {
        if (
          [...s.addresses.values()].filter((a) => a.ownerId === owner.id)
            .length >= 20
        )
          throw new ApiError(
            409,
            "address_limit",
            "Maximum twenty demo addresses",
          );
        const address = { ...input, id: makeId("address"), ownerId: owner.id };
        s.addresses.set(address.id, address);
        return address;
      }),
      201,
    );
  });
  app.patch("/addresses/:id", async (req, reply) => {
    const owner = await c.sessions.require(req, true);
    const input = addressSchema
      .extend({
        landmark: addressSchema.shape.landmark.removeDefault(),
        instructions: addressSchema.shape.instructions.removeDefault(),
      })
      .partial()
      .strict()
      .refine((v) => Object.keys(v).length > 0, "Provide at least one field")
      .parse(req.body);
    return result(
      req,
      reply,
      await c.repo.transaction((s) => {
        const old = s.addresses.get(params(req).id!);
        if (!old || old.ownerId !== owner.id)
          throw new ApiError(404, "not_found", "Address not found");
        const address = { ...old, ...input };
        s.addresses.set(address.id, address);
        return address;
      }),
    );
  });
  app.delete("/addresses/:id", async (req, reply) => {
    const owner = await c.sessions.require(req, true);
    return result(
      req,
      reply,
      await c.repo.transaction((s) => {
        const old = s.addresses.get(params(req).id!);
        if (!old || old.ownerId !== owner.id)
          throw new ApiError(404, "not_found", "Address not found");
        s.addresses.delete(old.id);
        return { deleted: true };
      }),
    );
  });
  app.get("/cart", async (req, reply) => {
    const owner = await c.sessions.require(req);
    return result(
      req,
      reply,
      await c.repo.read((s) => ({ lines: s.carts.get(owner.id) ?? [] })),
    );
  });
  app.put("/cart", async (req, reply) => {
    const owner = await c.sessions.require(req);
    const { lines } = z
      .object({ lines: z.array(lineSchema).max(50) })
      .strict()
      .parse(req.body);
    await c.commerce.sweep();
    return result(
      req,
      reply,
      await c.repo.transaction((s) => {
        const seen = new Set<string>();
        const counts = new Map<string, number>();
        for (const l of lines) {
          const key = `${l.id}:${l.variant}`;
          if (seen.has(key))
            throw new ApiError(
              400,
              "duplicate_line",
              "Cart lines must be unique per variant",
            );
          seen.add(key);
          const p = requireValue(s.products.get(l.id), "Product not found");
          const total = (counts.get(p.id) ?? 0) + l.quantity;
          counts.set(p.id, total);
          if (!p.variants.some((v) => v.id === l.variant) || p.stock < total)
            throw new ApiError(
              409,
              "out_of_stock",
              "Cart exceeds available stock",
            );
        }
        s.carts.set(owner.id, lines);
        return { lines };
      }),
    );
  });
  app.delete("/cart", async (req, reply) => {
    const owner = await c.sessions.require(req);
    await c.repo.transaction((s) => s.carts.delete(owner.id));
    return result(req, reply, { lines: [] });
  });
  app.get("/wishlist", async (req, reply) => {
    const owner = await c.sessions.require(req);
    return result(
      req,
      reply,
      await c.repo.read((s) => ({
        productIds: s.wishlists.get(owner.id) ?? [],
      })),
    );
  });
  app.put("/wishlist/:id", async (req, reply) => {
    const owner = await c.sessions.require(req);
    return result(
      req,
      reply,
      await c.repo.transaction((s) => {
        const id = params(req).id!;
        requireValue(s.products.get(id), "Product not found");
        const ids = [...new Set([...(s.wishlists.get(owner.id) ?? []), id])];
        s.wishlists.set(owner.id, ids);
        return { productIds: ids };
      }),
    );
  });
  app.delete("/wishlist/:id", async (req, reply) => {
    const owner = await c.sessions.require(req);
    return result(
      req,
      reply,
      await c.repo.transaction((s) => {
        const ids = (s.wishlists.get(owner.id) ?? []).filter(
          (id) => id !== params(req).id,
        );
        s.wishlists.set(owner.id, ids);
        return { productIds: ids };
      }),
    );
  });
  app.post(
    "/contact",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const owner = await c.sessions.require(req);
      const input = z
        .object({
          name: z.string().trim().min(2).max(100),
          email: z.email().max(200),
          message: z.string().trim().min(10).max(2000),
        })
        .strict()
        .parse(req.body);
      const id = await c.repo.transaction((s) => {
        if (
          [...s.contacts.values()].filter((m) => m.ownerId === owner.id)
            .length >= 10
        )
          throw new ApiError(
            429,
            "resource_limit",
            "Maximum ten demo messages",
          );
        const id = makeId("contact");
        s.contacts.set(id, {
          ...input,
          id,
          ownerId: owner.id,
          createdAt: iso(c.now()),
        });
        return id;
      });
      return result(
        req,
        reply,
        {
          id,
          demo: true,
          sent: false,
          message: "Saved in temporary memory only; no email was sent.",
        },
        201,
      );
    },
  );
};
