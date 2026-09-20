import {
  cartLineSchema,
  type CartLine,
  type PaymentService,
  type CatalogService,
} from "@/contracts";
import { getProduct, products, variantPrice } from "./catalog";
import { z } from "zod";
export function restoreCart(value: string | null): CartLine[] {
  try {
    const p = z
      .object({
        version: z.literal(1),
        lines: z.array(cartLineSchema).max(100),
      })
      .parse(JSON.parse(value ?? "null"));
    return p.lines
      .filter((l) => getProduct(l.id)?.stock)
      .map((l) => ({
        ...l,
        quantity: Math.min(l.quantity, getProduct(l.id)?.stock ?? 0),
      }));
  } catch {
    return [];
  }
}
export function subtotal(lines: CartLine[]) {
  return lines.reduce((n, l) => {
    const p = getProduct(l.id);
    return n + (p ? variantPrice(p, l.variant) * l.quantity : 0);
  }, 0);
}
export function quote(lines: CartLine[], coupon: string) {
  const base = subtotal(lines);
  const discount =
    coupon.toUpperCase() === "GROW10" ? Math.floor(base / 10) : 0;
  return {
    subtotal: base,
    discount,
    shipping: base ? 4900 : 0,
    total: base - discount + (base ? 4900 : 0),
  };
}
export function isServiceable(pin: string) {
  return ["221001", "221005", "221010"].includes(pin);
}
export async function delay(signal?: AbortSignal) {
  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, 150);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}
export const catalogService: CatalogService = {
  async search(query, signal) {
    await delay(signal);
    return {
      ok: true,
      data: products
        .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 6),
    };
  },
};
export const paymentService: PaymentService = {
  async confirm(_id, outcome, signal) {
    await delay(signal);
    return { ok: true, data: outcome };
  },
};
