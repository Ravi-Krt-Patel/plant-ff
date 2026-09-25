import type { CartLine } from "@/contracts";
import { getProduct } from "@/mocks/catalog";

export type CartAction =
  | { type: "load"; lines: CartLine[] }
  | { type: "add"; id: string; variant: CartLine["variant"] }
  | { type: "quantity"; id: string; variant: string; quantity: number }
  | { type: "clear" };
export function cartReducer(state: CartLine[], action: CartAction): CartLine[] {
  if (action.type === "load") return action.lines;
  if (action.type === "clear") return [];
  if (action.type === "quantity")
    return state
      .map((l) =>
        l.id === action.id && l.variant === action.variant
          ? {
              ...l,
              quantity: Math.min(
                10,
                getProduct(l.id)?.stock ?? 0,
                Math.max(0, action.quantity),
              ),
            }
          : l,
      )
      .filter((l) => l.quantity > 0);
  const p = getProduct(action.id);
  if (!p?.stock) return state;
  const found = state.find(
    (l) => l.id === action.id && l.variant === action.variant,
  );
  return found
    ? state.map((l) =>
        l === found
          ? { ...l, quantity: Math.min(l.quantity + 1, p.stock, 10) }
          : l,
      )
    : [...state, { id: action.id, variant: action.variant, quantity: 1 }];
}
