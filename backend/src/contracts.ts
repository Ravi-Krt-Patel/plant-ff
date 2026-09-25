import { z } from "zod";
export const idSchema = z.string().min(1).max(100);
export const lineSchema = z
  .object({
    id: idSchema,
    variant: z.enum(["nursery", "ceramic"]),
    quantity: z.number().int().min(1).max(10),
  })
  .strict();
export const linesSchema = z.array(lineSchema).min(1).max(50);
export const addressSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    phone: z.string().regex(/^[6-9]\d{9}$/),
    line: z.string().trim().min(5).max(250),
    locality: z.string().trim().min(2).max(100),
    landmark: z.string().max(150).default(""),
    pin: z.string().regex(/^\d{6}$/),
    instructions: z.string().max(500).default(""),
  })
  .strict();
export const quoteInputSchema = z
  .object({
    lines: linesSchema,
    address: addressSchema,
    slotId: idSchema,
    coupon: z.string().trim().max(40).default(""),
  })
  .strict();
export const orderInputSchema = z
  .object({
    quoteId: idSchema,
    quoteVersion: z.number().int().positive(),
    method: z.enum(["upi", "card", "cod"]),
  })
  .strict();
export const pageSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});
export const catalogQuerySchema = pageSchema
  .extend({
    q: z.string().trim().max(100).default(""),
    category: z
      .enum([
        "indoor-plants",
        "outdoor-plants",
        "flowering-plants",
        "succulents",
        "pots-planters",
        "plant-care",
        "bundles",
      ])
      .optional(),
    minPrice: z.coerce.number().int().nonnegative().optional(),
    maxPrice: z.coerce.number().int().nonnegative().optional(),
    light: z.enum(["Bright indirect", "Filtered light"]).optional(),
    care: z.enum(["Easy care", "A little attention"]).optional(),
    size: z.enum(["small", "medium"]).optional(),
    planter: z.enum(["nursery", "ceramic"]).optional(),
    availability: z.enum(["in_stock", "out_of_stock"]).optional(),
    sort: z
      .enum(["featured", "price-low", "price-high", "name"])
      .default("featured"),
  })
  .strict()
  .refine(
    (v) =>
      v.minPrice === undefined ||
      v.maxPrice === undefined ||
      v.minPrice <= v.maxPrice,
    {
      message: "Minimum price must not exceed maximum price",
      path: ["minPrice"],
    },
  );
export type Address = z.infer<typeof addressSchema>;
export type CartLine = z.infer<typeof lineSchema>;
export type QuoteInput = z.infer<typeof quoteInputSchema>;
export type OrderInput = z.infer<typeof orderInputSchema>;
export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  pricePaise: number;
  currency: "INR";
  image: string;
  tag: string;
  light: string;
  care: string;
  size: "small" | "medium";
  stock: number;
  version: number;
  demo: true;
  description: string;
  variants: {
    id: "nursery" | "ceramic";
    sku: string;
    pricePaise: number;
    potIncluded: boolean;
  }[];
};
export type QuoteLine = CartLine & {
  name: string;
  unitPricePaise: number;
  lineTotalPaise: number;
  productVersion: number;
};
export type Quote = {
  id: string;
  ownerId: string;
  version: number;
  lines: QuoteLine[];
  address: Address;
  slotId: string;
  coupon: string;
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  taxPaise: number;
  totalPaise: number;
  currency: "INR";
  createdAt: string;
  expiresAt: string;
  codEligible: boolean;
  usedOrderId?: string;
  demo: true;
};
export type PaymentStatus =
  | "unpaid"
  | "due_on_delivery"
  | "pending"
  | "captured"
  | "failed"
  | "dismissed"
  | "reconciliation_required"
  | "refund_requested"
  | "refunded";
export type Fulfillment =
  | "awaiting_payment"
  | "confirmed"
  | "preparing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "expired";
export type Order = {
  id: string;
  ownerId: string;
  quoteId: string;
  lines: QuoteLine[];
  address: Address;
  slotId: string;
  totalPaise: number;
  currency: "INR";
  method: "upi" | "card" | "cod";
  paymentStatus: PaymentStatus;
  fulfillment: Fulfillment;
  createdAt: string;
  updatedAt: string;
  reservationExpiresAt: string;
  resourcesReleased: boolean;
  version: number;
  demo: true;
  cancellation?: { id: string; reason: string; createdAt: string };
  tracking?: TrackingSnapshot;
};
export type TrackingSnapshot = {
  sequence: number;
  recordedAt: string;
  receivedAt: string;
  coordinates?: {
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    heading?: number;
  };
  estimatedArrival: string | null;
};
export type Session = {
  id: string;
  csrfToken: string;
  kind: "guest" | "demo_customer";
  expiresAt: number;
};
export type PaymentAttempt = {
  id: string;
  orderId: string;
  ownerId: string;
  method: "upi" | "card";
  status: "initiating" | "pending" | "captured" | "failed" | "dismissed";
  createdAt: string;
  updatedAt: string;
  demo: true;
};
export type SavedAddress = Address & { id: string; ownerId: string };
export type Capability = { orderId: string; expiresAt: number };
export type IdempotencyRecord = {
  fingerprint: string;
  result: unknown;
  expiresAt: number;
};
export type State = {
  products: Map<string, Product>;
  sessions: Map<string, Session>;
  quotes: Map<string, Quote>;
  orders: Map<string, Order>;
  attempts: Map<string, PaymentAttempt>;
  addresses: Map<string, SavedAddress>;
  carts: Map<string, CartLine[]>;
  wishlists: Map<string, string[]>;
  capabilities: Map<string, Capability>;
  idempotency: Map<string, IdempotencyRecord>;
  contacts: Map<
    string,
    {
      id: string;
      ownerId: string;
      name: string;
      email: string;
      message: string;
      createdAt: string;
    }
  >;
};
