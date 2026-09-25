import { z } from "zod";
export const productSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  category: z.string(),
  price: z.number().int().positive(),
  image: z.string(),
  tag: z.string(),
  light: z.string(),
  care: z.string(),
  stock: z.number().int().nonnegative(),
  description: z.string(),
});
export type Product = z.infer<typeof productSchema>;
export const cartLineSchema = z.object({
  id: z.string(),
  variant: z.enum(["nursery", "ceramic"]),
  quantity: z.number().int().min(1).max(10),
});
export type CartLine = z.infer<typeof cartLineSchema>;
export const addressSchema = z.object({
  name: z.string().min(2, "Enter a name"),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian phone number"),
  line: z.string().min(5, "Enter an address"),
  locality: z.string().min(2, "Enter a locality"),
  landmark: z.string(),
  pin: z.string().regex(/^\d{6}$/, "Enter a six-digit PIN"),
  instructions: z.string(),
  city: z.string().optional(),
  state: z.string().optional(),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
});
export type Address = z.infer<typeof addressSchema>;
export type PaymentStatus = "success" | "pending" | "failure" | "dismissed";
export type Order = {
  deliveryAddress?: Address;
  id: string;
  lines: CartLine[];
  total: number;
  method: string;
  payment: PaymentStatus;
  fulfillment:
    "confirmed" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";
};
export type ServiceResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: "unavailable" | "validation" | "access_denied";
      message: string;
    };
export interface CatalogService {
  search(
    query: string,
    signal?: AbortSignal,
  ): Promise<ServiceResult<Product[]>>;
}
export interface PaymentService {
  confirm(
    orderId: string,
    outcome: PaymentStatus,
    signal?: AbortSignal,
  ): Promise<ServiceResult<PaymentStatus>>;
}
