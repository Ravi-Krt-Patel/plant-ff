import type { Repository } from "../repositories/memory";
import type { Config } from "../config";
import type {
  Quote,
  QuoteLine,
  Order,
  State,
  OrderInput,
  QuoteInput,
  PaymentAttempt,
  Fulfillment,
} from "../contracts";
import { ApiError, requireValue } from "../errors";
import { deliverySlots, serviceability } from "./delivery";
import {
  expireReservations,
  idempotent,
  iso,
  makeId,
  ownOrder,
  releaseResources,
  digest,
  token,
} from "./shared";
export class CommerceService {
  constructor(
    private repo: Repository,
    private config: Config,
    private now: () => number = Date.now,
  ) {}
  async sweep() {
    return this.repo.transaction((s) => expireReservations(s, this.now()));
  }
  private lines(s: State, input: QuoteInput["lines"]): QuoteLine[] {
    const merged = new Map<string, QuoteInput["lines"][number]>();
    for (const l of input) {
      const key = `${l.id}:${l.variant}`;
      const existing = merged.get(key);
      merged.set(key, {
        ...l,
        quantity: l.quantity + (existing?.quantity ?? 0),
      });
    }
    const counts = new Map<string, number>();
    return [...merged.values()].map((l) => {
      if (l.quantity > 10)
        throw new ApiError(
          400,
          "quantity_limit",
          "Maximum ten units per variant",
        );
      const p = requireValue(s.products.get(l.id), "Product not found");
      const variant = requireValue(
        p.variants.find((v) => v.id === l.variant),
        "Variant not found",
      );
      const total = (counts.get(p.id) ?? 0) + l.quantity;
      counts.set(p.id, total);
      if (p.stock < total)
        throw new ApiError(
          409,
          "out_of_stock",
          `${p.name} has insufficient stock`,
        );
      return {
        ...l,
        name: p.name,
        unitPricePaise: variant.pricePaise,
        lineTotalPaise: variant.pricePaise * l.quantity,
        productVersion: p.version,
      };
    });
  }
  async createQuote(ownerId: string, input: QuoteInput) {
    return this.repo.transaction((s) => {
      expireReservations(s, this.now());
      if (
        [...s.quotes.values()].filter((q) => q.ownerId === ownerId).length >=
        100
      )
        throw new ApiError(
          429,
          "resource_limit",
          "Too many quotes in this demo session",
        );
      const delivery = serviceability(s, input.address.pin, this.now());
      if (!delivery.eligible)
        throw new ApiError(
          422,
          "unserviceable",
          "Address is outside configured demo zones",
        );
      const slot = delivery.slots.find((slot) => slot.id === input.slotId);
      if (!slot || slot.remaining < 1)
        throw new ApiError(
          409,
          "slot_unavailable",
          "Choose an available demo delivery slot",
        );
      const lines = this.lines(s, input.lines);
      const subtotal = lines.reduce((n, l) => n + l.lineTotalPaise, 0);
      const coupon = input.coupon.toUpperCase();
      if (coupon && coupon !== "GROW10")
        throw new ApiError(422, "invalid_coupon", "Demo coupon is invalid");
      const discount = coupon ? Math.floor(subtotal / 10) : 0;
      const quote: Quote = {
        id: makeId("quote"),
        ownerId,
        version: 1,
        lines,
        address: input.address,
        slotId: input.slotId,
        coupon,
        subtotalPaise: subtotal,
        discountPaise: discount,
        shippingPaise: 4900,
        taxPaise: 0,
        totalPaise: subtotal - discount + 4900,
        currency: "INR",
        createdAt: iso(this.now()),
        expiresAt: iso(this.now() + this.config.quoteTtlMs),
        codEligible: delivery.codEligible,
        demo: true,
      };
      s.quotes.set(quote.id, quote);
      return quote;
    });
  }
  async createOrder(ownerId: string, input: OrderInput, key: string) {
    await this.sweep();
    return this.repo.transaction((s) =>
      idempotent(s, ownerId, "create-order", key, input, this.now(), () => {
        if (
          [...s.orders.values()].filter((o) => o.ownerId === ownerId).length >=
          50
        )
          throw new ApiError(429, "resource_limit", "Demo order limit reached");
        const q = s.quotes.get(input.quoteId);
        if (!q || q.ownerId !== ownerId)
          throw new ApiError(404, "not_found", "Quote not found");
        if (q.usedOrderId)
          throw new ApiError(
            409,
            "quote_used",
            "Quote already created an order",
            { orderId: q.usedOrderId },
          );
        if (
          Date.parse(q.expiresAt) <= this.now() ||
          q.version !== input.quoteVersion
        )
          throw new ApiError(409, "quote_expired", "Create a new quote");
        const current = this.lines(s, q.lines);
        if (
          current.some(
            (line, i) =>
              line.unitPricePaise !== q.lines[i]?.unitPricePaise ||
              line.productVersion !== q.lines[i]?.productVersion,
          )
        )
          throw new ApiError(
            409,
            "price_changed",
            "Catalog changed. Request a new quote",
          );
        const delivery = serviceability(s, q.address.pin, this.now());
        if (!delivery.eligible)
          throw new ApiError(422, "unserviceable", "Delivery unavailable");
        if (
          input.method === "cod" &&
          (!delivery.codEligible || q.totalPaise > 200000)
        )
          throw new ApiError(
            422,
            "cod_unavailable",
            "Demo COD requires an eligible zone and a total no greater than ₹2,000",
          );
        const slot = deliverySlots(s, this.now()).find(
          (x) => x.id === q.slotId,
        );
        if (!slot || slot.remaining < 1)
          throw new ApiError(
            409,
            "slot_unavailable",
            "Delivery slot is no longer available",
          );
        for (const line of q.lines) {
          const product = requireValue(s.products.get(line.id));
          product.stock -= line.quantity;
        }
        const order: Order = {
          id: makeId("order"),
          ownerId,
          quoteId: q.id,
          lines: q.lines,
          address: q.address,
          slotId: q.slotId,
          totalPaise: q.totalPaise,
          currency: "INR",
          method: input.method,
          paymentStatus: input.method === "cod" ? "due_on_delivery" : "unpaid",
          fulfillment:
            input.method === "cod" ? "confirmed" : "awaiting_payment",
          createdAt: iso(this.now()),
          updatedAt: iso(this.now()),
          reservationExpiresAt: iso(this.now() + this.config.reservationTtlMs),
          resourcesReleased: false,
          version: 1,
          demo: true,
        };
        s.orders.set(order.id, order);
        q.usedOrderId = order.id;
        return order;
      }),
    );
  }
  async getOrder(ownerId: string, id: string) {
    await this.sweep();
    return this.repo.read((s) => ownOrder(s, ownerId, id));
  }
  async paymentSession(ownerId: string, id: string, key: string) {
    await this.sweep();
    return this.repo.transaction((s) =>
      idempotent(
        s,
        ownerId,
        `payment:${id}`,
        key,
        { orderId: id },
        this.now(),
        () => {
          const order = ownOrder(s, ownerId, id);
          if (order.method === "cod")
            throw new ApiError(
              409,
              "cod_payment",
              "Cash on delivery bypasses prepaid payment",
            );
          if (
            order.fulfillment !== "awaiting_payment" ||
            order.paymentStatus === "captured"
          )
            throw new ApiError(
              409,
              "payment_unavailable",
              "Order cannot start another payment",
            );
          const active = [...s.attempts.values()].find(
            (a) =>
              a.orderId === id && ["initiating", "pending"].includes(a.status),
          );
          if (active) return active;
          if (
            [...s.attempts.values()].filter((a) => a.orderId === id).length >=
            10
          )
            throw new ApiError(
              429,
              "resource_limit",
              "Demo payment attempt limit reached",
            );
          const attempt: PaymentAttempt = {
            id: makeId("attempt"),
            orderId: id,
            ownerId,
            method: order.method,
            status: "initiating",
            createdAt: iso(this.now()),
            updatedAt: iso(this.now()),
            demo: true,
          };
          s.attempts.set(attempt.id, attempt);
          order.paymentStatus = "pending";
          order.updatedAt = iso(this.now());
          order.version++;
          return attempt;
        },
      ),
    );
  }
  async simulate(
    ownerId: string,
    attemptId: string,
    outcome: "success" | "pending" | "failure" | "dismissed" | "timeout",
  ) {
    await this.sweep();
    return this.repo.transaction((s) => {
      const attempt = s.attempts.get(attemptId);
      if (!attempt || attempt.ownerId !== ownerId)
        throw new ApiError(404, "not_found", "Payment attempt not found");
      const order = ownOrder(s, ownerId, attempt.orderId);
      const status =
        outcome === "success"
          ? "captured"
          : outcome === "failure"
            ? "failed"
            : outcome === "timeout"
              ? "pending"
              : outcome;
      const terminal = ["captured", "failed", "dismissed"].includes(
        attempt.status,
      );
      if (terminal) {
        if (attempt.status === status) return { attempt, order };
        throw new ApiError(
          409,
          "invalid_transition",
          "Terminal payment outcome cannot change",
        );
      }
      attempt.status = status;
      attempt.updatedAt = iso(this.now());
      if (status === "captured") {
        if (
          order.fulfillment === "cancelled" ||
          order.fulfillment === "expired" ||
          order.resourcesReleased
        ) {
          order.paymentStatus = "reconciliation_required";
        } else {
          order.paymentStatus = "captured";
          order.fulfillment = "confirmed";
        }
      } else if (order.fulfillment === "awaiting_payment") {
        order.paymentStatus = status;
      }
      order.version++;
      order.updatedAt = iso(this.now());
      return { attempt, order };
    });
  }
  async cancel(ownerId: string, id: string, reason: string, key: string) {
    await this.sweep();
    return this.repo.transaction((s) =>
      idempotent(
        s,
        ownerId,
        `cancel:${id}`,
        key,
        { reason },
        this.now(),
        () => {
          const order = ownOrder(s, ownerId, id);
          if (order.fulfillment === "cancelled") return order;
          if (
            !["awaiting_payment", "confirmed", "preparing"].includes(
              order.fulfillment,
            )
          )
            throw new ApiError(
              409,
              "cancellation_unavailable",
              "Order can no longer be cancelled",
            );
          releaseResources(s, order);
          order.fulfillment = "cancelled";
          if (order.paymentStatus === "captured")
            order.paymentStatus = "refund_requested";
          order.cancellation = {
            id: makeId("cancel"),
            reason,
            createdAt: iso(this.now()),
          };
          order.updatedAt = iso(this.now());
          order.version++;
          return order;
        },
      ),
    );
  }
  async accessToken(ownerId: string, id: string) {
    return this.repo.transaction((s) => {
      ownOrder(s, ownerId, id);
      for (const [hash, cap] of s.capabilities)
        if (cap.orderId === id) s.capabilities.delete(hash);
      const accessToken = token();
      const expiresAt = this.now() + 30 * 60 * 1000;
      s.capabilities.set(digest(accessToken), { orderId: id, expiresAt });
      return { orderId: id, accessToken, expiresAt: iso(expiresAt) };
    });
  }
  async lookup(id: string, accessToken: string) {
    await this.sweep();
    return this.repo.read((s) => {
      const capability = s.capabilities.get(digest(accessToken));
      if (
        !capability ||
        capability.expiresAt <= this.now() ||
        capability.orderId !== id
      )
        throw new ApiError(
          404,
          "not_found",
          "Order access is invalid or expired",
        );
      return requireValue(s.orders.get(id), "Order not found");
    });
  }
  async tracking(ownerId: string, id: string) {
    const order = await this.getOrder(ownerId, id);
    const t = order.tracking;
    const active = order.fulfillment === "out_for_delivery";
    return {
      orderId: id,
      fulfillment: order.fulfillment,
      paymentStatus: order.paymentStatus,
      sequence: t?.sequence ?? order.version,
      recordedAt: t?.recordedAt ?? order.updatedAt,
      receivedAt: t?.receivedAt ?? order.updatedAt,
      stale: !t || this.now() - Date.parse(t.recordedAt) > 60000,
      locationAvailable: active && !!t?.coordinates,
      coordinates: active ? (t?.coordinates ?? null) : null,
      estimatedArrival: active ? (t?.estimatedArrival ?? null) : null,
      demo: true,
      timeline: ["confirmed", "preparing", "out_for_delivery", "delivered"],
      message: "Simulated tracking. No actual rider GPS is connected.",
    };
  }
  async transition(id: string, status: Fulfillment) {
    return this.repo.transaction((s) => {
      const order = requireValue(s.orders.get(id));
      const allowed: Partial<Record<Fulfillment, Fulfillment[]>> = {
        confirmed: ["preparing"],
        preparing: ["out_for_delivery"],
        out_for_delivery: ["delivered"],
      };
      if (!allowed[order.fulfillment]?.includes(status))
        throw new ApiError(
          409,
          "invalid_transition",
          "Fulfillment transition is not allowed",
        );
      order.fulfillment = status;
      order.updatedAt = iso(this.now());
      order.version++;
      return order;
    });
  }
}
