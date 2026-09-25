import { z } from "zod";
const legacyOptionalText = z.preprocess(
  (value) => (value === null ? undefined : value),
  z.string().optional(),
);
export const legacyDeliveryAddressSchema = z.object({
  name: z.string(),
  phone: z.string(),
  line: z.string(),
  locality: z.string(),
  pin: z.string(),
  landmark: legacyOptionalText,
  instructions: legacyOptionalText,
  city: legacyOptionalText,
  state: legacyOptionalText,
  latitude: z.number().finite().min(-90).max(90).nullish(),
  longitude: z.number().finite().min(-180).max(180).nullish(),
});
export type LegacyDeliveryAddress = z.infer<typeof legacyDeliveryAddressSchema>;
export const deliveryAddressSchema = z.object({
  name: z.string().trim().min(2, "Enter the recipient’s full name").max(100),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number"),
  line: z
    .string()
    .trim()
    .min(5, "Enter your house/building and street")
    .max(300),
  locality: z.string().trim().min(2, "Enter your locality").max(100),
  city: z.string().trim().min(2, "Enter your city").max(100),
  state: z.string().trim().min(2, "Enter your state").max(100),
  pin: z.string().regex(/^\d{6}$/, "Enter a six-digit PIN code"),
  landmark: z.string().max(150),
  instructions: z.string().max(300),
  latitude: z
    .number({ error: "Choose your delivery pin or enter latitude" })
    .finite()
    .min(-90)
    .max(90),
  longitude: z
    .number({ error: "Choose your delivery pin or enter longitude" })
    .finite()
    .min(-180)
    .max(180),
});
export type DeliveryAddress = z.infer<typeof deliveryAddressSchema>;
export const savedAddressSchema = z.object({
  id: z.string(),
  value: legacyDeliveryAddressSchema,
  isDefault: z.boolean().default(false),
});
export type SavedAddress = z.infer<typeof savedAddressSchema>;
export const sessionSchema = z.object({
  sessionId: z.string(),
  userId: z.string().nullable(),
  role: z.string(),
  verifiedAt: z.string().nullable(),
});
export type Session = z.infer<typeof sessionSchema>;
export const backendOrderSchema = z.object({
  id: z.string(),
  reference: z.string(),
  snapshot: z
    .object({
      input: z
        .object({ address: legacyDeliveryAddressSchema.optional() })
        .passthrough(),
    })
    .passthrough(),
  totalPaise: z.number().int(),
  currency: z.literal("INR"),
  method: z.string(),
  status: z.string(),
  paymentState: z.string(),
  version: z.number(),
  createdAt: z.string(),
  reservationExpiresAt: z.string(),
});
export type BackendOrder = z.infer<typeof backendOrderSchema>;
export const trackingSchema = z.object({
  orderId: z.string(),
  status: z.string(),
  version: z.number(),
  timeline: z.array(z.object({ status: z.string(), createdAt: z.string() })),
  simulation: z.boolean(),
  destination: legacyDeliveryAddressSchema.nullable().optional(),
  estimatedDelivery: z.string().nullish(),
  location: z
    .object({
      latitude: z.number().finite().min(-90).max(90),
      longitude: z.number().finite().min(-180).max(180),
      accuracy: z.number(),
      recordedAt: z.string(),
      receivedAt: z.string(),
      stale: z.boolean(),
      source: z.string().optional(),
    })
    .nullable(),
});
export type TrackingSnapshot = z.infer<typeof trackingSchema>;
export const serviceabilitySchema = z.object({
  eligible: z.boolean(),
  reason: z.string().optional(),
  cod: z.boolean().optional(),
  demo: z.boolean().optional(),
  shippingPaise: z.number().optional(),
  slots: z.array(
    z.object({ id: z.string(), startsAt: z.string(), cutoffAt: z.string() }),
  ),
});
export const quoteSchema = z.object({
  id: z.string(),
  version: z.number(),
  expiresAt: z.string(),
  totals: z.object({
    subtotalPaise: z.number(),
    discountPaise: z.number(),
    shippingPaise: z.number(),
    taxPaise: z.number(),
    totalPaise: z.number(),
    currency: z.literal("INR"),
  }),
});
export type CheckoutQuote = z.infer<typeof quoteSchema>;
