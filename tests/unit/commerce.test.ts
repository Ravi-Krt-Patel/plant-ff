import { describe, it, expect } from "vitest";
import { money, products } from "../../src/mocks/catalog";
import { restoreCart, quote, isServiceable } from "../../src/mocks/services";
import { cartReducer } from "../../src/features/cart/reducer";
import { addressSchema } from "../../src/contracts";
describe("demo commerce boundaries", () => {
  it("formats integer paise", () => {
    expect(money(44900)).toBe("₹449");
  });
  it("rejects corrupted and out-of-range cart storage", () => {
    expect(restoreCart("{bad")).toEqual([]);
    expect(
      restoreCart(
        JSON.stringify({
          version: 1,
          lines: [{ id: "p1", variant: "nursery", quantity: 999 }],
        }),
      ),
    ).toEqual([]);
  });
  it("discards unknown and sold-out products", () => {
    expect(
      restoreCart(
        JSON.stringify({
          version: 1,
          lines: [
            { id: "unknown", variant: "nursery", quantity: 1 },
            { id: "p14", variant: "nursery", quantity: 1 },
          ],
        }),
      ),
    ).toEqual([]);
  });
  it("keeps variants separate and bounds quantities", () => {
    let s = cartReducer([], { type: "add", id: "p1", variant: "nursery" });
    s = cartReducer(s, { type: "add", id: "p1", variant: "ceramic" });
    expect(s).toHaveLength(2);
    s = cartReducer(s, {
      type: "quantity",
      id: "p1",
      variant: "nursery",
      quantity: 50,
    });
    expect(s[0]?.quantity).toBe(10);
    s = cartReducer(s, {
      type: "quantity",
      id: "p1",
      variant: "nursery",
      quantity: 0,
    });
    expect(s).toHaveLength(1);
  });
  it("will not add sold-out products", () => {
    expect(
      cartReducer([], { type: "add", id: "p14", variant: "nursery" }),
    ).toEqual([]);
  });
  it("calculates deterministic quotes in paise", () => {
    const q = quote([{ id: "p1", variant: "ceramic", quantity: 2 }], "GROW10");
    expect(q).toEqual({
      subtotal: 179800,
      discount: 17980,
      shipping: 4900,
      total: 166720,
    });
  });
  it("does not confuse PIN syntax with serviceability", () => {
    expect(isServiceable("221999")).toBe(false);
    expect(isServiceable("221001")).toBe(true);
    expect(
      addressSchema.safeParse({
        name: "Demo",
        phone: "9000000000",
        line: "12 Sample Lane",
        locality: "Demo",
        pin: "123",
        landmark: "",
        instructions: "",
      }).success,
    ).toBe(false);
  });
  it("provides 24 stable sample products", () => {
    expect(products).toHaveLength(24);
    expect(new Set(products.map((p) => p.id)).size).toBe(24);
  });
});
