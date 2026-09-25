import { z } from "zod";
import {
  addressSchema,
  lineSchema,
  quoteInputSchema,
  orderInputSchema,
} from "./contracts";
type Endpoint = {
  method: string;
  path: string;
  summary: string;
  auth?: "session" | "operations";
  body?: object;
  created?: boolean;
  unavailable?: boolean;
  idempotent?: boolean;
};
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const object = (
  properties: Record<string, unknown>,
  required = Object.keys(properties),
) => ({ type: "object", properties, required, additionalProperties: false });
const string = { type: "string" };
const endpoints: Endpoint[] = [
  {
    method: "get",
    path: "/health",
    summary: "Backend readiness, demo mode and memory storage",
  },
  {
    method: "get",
    path: "/products",
    summary:
      "Paginated catalog. Query: q, category, minPrice/maxPrice (paise), light, care, size, planter, availability, sort, page, limit",
  },
  {
    method: "get",
    path: "/products/{slug}",
    summary: "Product details with variants",
  },
  {
    method: "get",
    path: "/search",
    summary: "Search catalog using the same filters as products",
  },
  { method: "get", path: "/categories", summary: "Configured sample taxonomy" },
  {
    method: "get",
    path: "/collections/{slug}",
    summary: "Paginated category products",
  },
  { method: "get", path: "/plant-care", summary: "Care guide index" },
  { method: "get", path: "/plant-care/{slug}", summary: "Care guide content" },
  {
    method: "get",
    path: "/store/config",
    summary: "Public demo delivery/payment settings",
  },
  {
    method: "post",
    path: "/serviceability/check",
    summary: "Check an exact configured demo PIN and current slots",
    body: object({ pin: { type: "string", pattern: "^[0-9]{6}$" } }),
  },
  {
    method: "post",
    path: "/auth/guest",
    summary: "Create or rotate a guest session; existing cookie requires CSRF",
    body: object({}),
    created: true,
  },
  {
    method: "post",
    path: "/auth/demo-sign-in",
    summary:
      "Explicit demo-customer sign-in; no OTP or real identity verification",
    body: object({}),
    created: true,
  },
  {
    method: "get",
    path: "/auth/session",
    summary: "Current session and CSRF token",
    auth: "session",
  },
  {
    method: "post",
    path: "/auth/sign-out",
    summary: "Invalidate session",
    auth: "session",
  },
  {
    method: "post",
    path: "/auth/otp/request",
    summary: "Reserved real OTP integration endpoint",
    unavailable: true,
  },
  {
    method: "post",
    path: "/auth/otp/verify",
    summary: "Reserved real OTP verification endpoint",
    unavailable: true,
  },
  {
    method: "get",
    path: "/addresses",
    summary: "List demo-customer address book",
    auth: "session",
  },
  {
    method: "post",
    path: "/addresses",
    summary: "Create address; demo-customer session required",
    auth: "session",
    body: ref("Address"),
    created: true,
  },
  {
    method: "patch",
    path: "/addresses/{id}",
    summary: "Update supplied address fields only",
    auth: "session",
    body: { ...z.toJSONSchema(addressSchema), required: [] },
  },
  {
    method: "delete",
    path: "/addresses/{id}",
    summary: "Delete owned address",
    auth: "session",
  },
  {
    method: "get",
    path: "/cart",
    summary: "Session cart identifiers and quantities",
    auth: "session",
  },
  {
    method: "put",
    path: "/cart",
    summary: "Replace validated cart lines",
    auth: "session",
    body: object({
      lines: { type: "array", items: ref("CartLine"), maxItems: 50 },
    }),
  },
  { method: "delete", path: "/cart", summary: "Empty cart", auth: "session" },
  {
    method: "get",
    path: "/wishlist",
    summary: "List saved product IDs",
    auth: "session",
  },
  {
    method: "put",
    path: "/wishlist/{id}",
    summary: "Save product idempotently",
    auth: "session",
  },
  {
    method: "delete",
    path: "/wishlist/{id}",
    summary: "Remove saved product",
    auth: "session",
  },
  {
    method: "post",
    path: "/checkout/quote",
    summary: "Server-priced, expiring quote; reserves nothing",
    auth: "session",
    body: ref("QuoteInput"),
    created: true,
  },
  {
    method: "post",
    path: "/checkout/quotes",
    summary: "Alias for checkout/quote",
    auth: "session",
    body: ref("QuoteInput"),
    created: true,
  },
  {
    method: "post",
    path: "/orders",
    summary: "Create one order and atomically reserve stock/slot",
    auth: "session",
    body: ref("OrderInput"),
    created: true,
    idempotent: true,
  },
  {
    method: "get",
    path: "/orders",
    summary: "Paginated session-owned orders",
    auth: "session",
  },
  {
    method: "get",
    path: "/orders/{id}",
    summary: "Owned order detail",
    auth: "session",
  },
  {
    method: "post",
    path: "/orders/{id}/payment-sessions",
    summary: "Start or reuse a demo payment attempt for an existing order",
    auth: "session",
    body: object({}),
    created: true,
    idempotent: true,
  },
  {
    method: "get",
    path: "/orders/{id}/payment-status",
    summary: "Current server-held demo payment status",
    auth: "session",
  },
  {
    method: "post",
    path: "/payments/demo/{id}/simulate",
    summary: "Select a demo attempt outcome, never a real payment",
    auth: "session",
    body: object({
      outcome: {
        enum: ["success", "pending", "failure", "dismissed", "timeout"],
      },
    }),
  },
  {
    method: "post",
    path: "/orders/{id}/cancellation-requests",
    summary:
      "Cancel eligible order and release resources once; captured becomes refund_requested",
    auth: "session",
    idempotent: true,
    body: object({ reason: { type: "string", minLength: 3, maxLength: 500 } }),
  },
  {
    method: "get",
    path: "/orders/{id}/tracking",
    summary:
      "Owned timeline and optional simulated coordinates during active delivery",
    auth: "session",
  },
  {
    method: "post",
    path: "/orders/{id}/guest-access",
    summary:
      "Issue an expiring order-scoped access capability; rotates previous token",
    auth: "session",
    created: true,
  },
  {
    method: "post",
    path: "/orders/lookup",
    summary: "Look up an order only with its server-issued capability",
    body: object({
      orderId: string,
      accessToken: { type: "string", minLength: 32, maxLength: 100 },
    }),
  },
  {
    method: "post",
    path: "/payments/razorpay/create-order",
    summary: "Reserved provider integration, disabled with memory storage",
    auth: "session",
    unavailable: true,
  },
  {
    method: "post",
    path: "/payments/razorpay/verify",
    summary:
      "Reserved signature/capture verification, disabled with memory storage",
    auth: "session",
    unavailable: true,
  },
  {
    method: "post",
    path: "/webhooks/razorpay",
    summary:
      "Reserved raw-body signed webhook integration, disabled with memory storage",
    unavailable: true,
  },
  {
    method: "post",
    path: "/contact",
    summary: "Store a temporary demo message; does not send email",
    auth: "session",
    created: true,
    body: object({
      name: { type: "string", minLength: 2, maxLength: 100 },
      email: { type: "string", format: "email" },
      message: { type: "string", minLength: 10, maxLength: 2000 },
    }),
  },
  {
    method: "patch",
    path: "/operations/products/{id}",
    summary: "Update sample available stock and/or price",
    auth: "operations",
    body: object(
      {
        stock: { type: "integer", minimum: 0, maximum: 10000 },
        pricePaise: { type: "integer", minimum: 100, maximum: 10000000 },
      },
      [],
    ),
  },
  {
    method: "patch",
    path: "/operations/orders/{id}/fulfillment",
    summary: "Advance confirmed → preparing → out_for_delivery → delivered",
    auth: "operations",
    body: object({
      status: { enum: ["preparing", "out_for_delivery", "delivered"] },
    }),
  },
  {
    method: "post",
    path: "/operations/orders/{id}/tracking",
    summary:
      "Ingest explicitly synthetic tracking coordinates with increasing sequence",
    auth: "operations",
    body: object(
      {
        sequence: { type: "integer", minimum: 1 },
        recordedAt: { type: "string", format: "date-time" },
        coordinates: object(
          {
            latitude: { type: "number", minimum: -90, maximum: 90 },
            longitude: { type: "number", minimum: -180, maximum: 180 },
            accuracyMeters: { type: "number", minimum: 0 },
            heading: { type: "number", minimum: 0, maximum: 360 },
          },
          ["latitude", "longitude", "accuracyMeters"],
        ),
        estimatedArrival: { type: ["string", "null"], format: "date-time" },
      },
      ["sequence", "recordedAt"],
    ),
  },
  {
    method: "post",
    path: "/operations/orders/{id}/collect-cod",
    summary: "Simulate COD collection for a delivered order",
    auth: "operations",
  },
  {
    method: "post",
    path: "/operations/orders/{id}/refund-completed",
    summary: "Mark a demo refund case settled; no provider refund occurs",
    auth: "operations",
  },
];
export function openApiDocument() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const e of endpoints) {
    const parameters: object[] = [...e.path.matchAll(/\{(\w+)\}/g)].map(
      (m) => ({
        name: m[1],
        in: "path",
        required: true,
        schema: { type: "string" },
      }),
    );
    if (e.auth === "session" && e.method !== "get")
      parameters.push({
        name: "X-CSRF-Token",
        in: "header",
        required: true,
        schema: string,
      });
    if (e.idempotent)
      parameters.push({
        name: "Idempotency-Key",
        in: "header",
        required: true,
        schema: { type: "string", pattern: "^[A-Za-z0-9_-]{8,100}$" },
      });
    paths[e.path] ??= {};
    paths[e.path]![e.method] = {
      summary: e.summary,
      parameters,
      security: e.auth
        ? [
            {
              [e.auth === "operations" ? "OperationsBearer" : "SessionCookie"]:
                [],
            },
          ]
        : [],
      ...(e.body
        ? {
            requestBody: {
              required: true,
              content: { "application/json": { schema: e.body } },
            },
          }
        : {}),
      responses: {
        [e.unavailable ? "503" : e.created ? "201" : "200"]: {
          description: e.unavailable
            ? "Provider intentionally unavailable"
            : "Successful demo response",
          content: {
            "application/json": {
              schema: e.unavailable
                ? ref("ErrorEnvelope")
                : ref("SuccessEnvelope"),
            },
          },
        },
        default: {
          description:
            "Validation, authorization, conflict, rate limit or configuration error",
          content: { "application/json": { schema: ref("ErrorEnvelope") } },
        },
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Kashi Greens Backend API",
      version: "1.0.0",
      description:
        "Backend-only demo. In-memory storage; all state resets on restart. No database, verified identity, real payments, email or rider feed. Every endpoint also has a /v1 alias. Private responses are no-store.",
    },
    servers: [
      { url: "http://localhost:4000/api" },
      { url: "http://localhost:4000/v1" },
    ],
    paths,
    components: {
      securitySchemes: {
        SessionCookie: { type: "apiKey", in: "cookie", name: "kg_api_session" },
        OperationsBearer: { type: "http", scheme: "bearer" },
      },
      schemas: {
        Address: z.toJSONSchema(addressSchema),
        CartLine: z.toJSONSchema(lineSchema),
        QuoteInput: z.toJSONSchema(quoteInputSchema),
        OrderInput: z.toJSONSchema(orderInputSchema),
        SuccessEnvelope: object({
          data: {},
          requestId: string,
          meta: object({
            mode: { const: "demo" },
            storage: { const: "memory" },
          }),
        }),
        ErrorEnvelope: object({
          error: object(
            {
              code: string,
              message: string,
              details: {},
              retryable: { type: "boolean" },
            },
            ["code", "message", "retryable"],
          ),
          requestId: string,
        }),
      },
    },
  };
}
