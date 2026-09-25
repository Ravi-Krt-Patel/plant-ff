import { openApiDocument } from "./openapi";
import Fastify, { LogController } from "fastify";

import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { configSchema, type Config } from "./config";
import { ApiError } from "./errors";
import { MemoryRepository, type Repository } from "./repositories/memory";
import { SessionService } from "./domain/sessions";
import { CommerceService } from "./domain/commerce";
import { CatalogService } from "./domain/catalog";
import { catalogRoutes } from "./routes/catalog";
import { accountRoutes } from "./routes/account";
import { commerceRoutes } from "./routes/commerce";
import { operationsRoutes } from "./routes/operations";
export async function createApp(
  options: {
    config?: Partial<Config>;
    repository?: Repository;
    now?: () => number;
    logger?: boolean;
  } = {},
) {
  const config = configSchema.parse(options.config ?? {});
  const repo = options.repository ?? new MemoryRepository();
  const now = options.now ?? Date.now;
  const app = Fastify({
    logger: options.logger
      ? {
          level: "info",
          redact: [
            "req.headers.cookie",
            "req.headers.authorization",
            'req.headers["x-csrf-token"]',
            'res.headers["set-cookie"]',
          ],
        }
      : false,
    logController: new LogController({ disableRequestLogging: true }),
    bodyLimit: 32768,
    requestTimeout: 10000,
    connectionTimeout: 15000,
    keepAliveTimeout: 5000,
    trustProxy: false,
    genReqId: () => randomUUID(),
  });
  await app.register(cookie);
  await app.register(cors, {
    origin: config.origins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "X-CSRF-Token",
      "Idempotency-Key",
      "Authorization",
    ],
    exposedHeaders: ["X-Request-Id"],
  });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
    errorResponseBuilder: () => ({
      statusCode: 429,
      code: "rate_limited",
      error: "Too Many Requests",
      message: "Too many requests. Please try again later.",
    }),
  });
  app.addHook("onRequest", async (req, reply) => {
    reply
      .header("Cache-Control", "no-store")
      .header("X-Content-Type-Options", "nosniff")
      .header("X-Request-Id", req.id)
      .header("X-Robots-Tag", "noindex, nofollow");
    const origin = req.headers.origin;
    if (origin && !config.origins.includes(origin))
      throw new ApiError(403, "origin_not_allowed", "Origin is not allowed");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers["sec-fetch-site"] === "cross-site"
    )
      throw new ApiError(
        403,
        "cross_site_request",
        "Cross-site mutation is not allowed",
      );
  });
  app.setErrorHandler((error, req, reply) => {
    if (error instanceof ZodError)
      return reply.code(400).send({
        error: {
          code: "validation_error",
          message: "Request validation failed",
          details: error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
          retryable: false,
        },
        requestId: req.id,
      });
    const known = error instanceof ApiError;
    const code =
      typeof error === "object" && error !== null && "statusCode" in error
        ? Number(error.statusCode)
        : 500;
    const status = known
      ? error.status
      : [400, 413, 415, 429].includes(code)
        ? code
        : 500;
    const message = known
      ? error.message
      : status === 429
        ? "Too many requests. Please try again later."
        : status === 413
          ? "Request body is too large"
          : status === 415
            ? "Use application/json for request bodies"
            : status === 400
              ? "Invalid request"
              : "An unexpected error occurred";
    if (status >= 500)
      req.log.error(
        {
          requestId: req.id,
          status,
          errorCode: known ? error.code : "internal_error",
        },
        "API request failed",
      );
    return reply.code(status).send({
      error: {
        code: known
          ? error.code
          : status === 429
            ? "rate_limited"
            : status === 500
              ? "internal_error"
              : "invalid_request",
        message,
        details: known ? error.details : undefined,
        retryable: status === 429 || status === 503,
      },
      requestId: req.id,
    });
  });
  app.setNotFoundHandler((req, reply) =>
    reply.code(404).send({
      error: {
        code: "not_found",
        message: "API route not found",
        retryable: false,
      },
      requestId: req.id,
    }),
  );
  const sessions = new SessionService(repo, config, now);
  const commerce = new CommerceService(repo, config, now);
  const context = {
    config,
    repo,
    now,
    sessions,
    commerce,
    catalog: new CatalogService(repo),
  };
  for (const prefix of ["/api", "/v1"])
    await app.register(
      async (scoped) => {
        scoped.get("/openapi.json", async () => openApiDocument());
        catalogRoutes(scoped, context);
        accountRoutes(scoped, context);
        commerceRoutes(scoped, context);
        await scoped.register(async (ops) => operationsRoutes(ops, context), {
          prefix: "/operations",
        });
      },
      { prefix },
    );
  const timer = setInterval(() => {
    void sessions.cleanup().catch(() => app.log.error("Demo cleanup failed"));
  }, 60000);
  timer.unref();
  app.addHook("onClose", async () => {
    clearInterval(timer);
  });
  await app.ready();
  return app;
}
