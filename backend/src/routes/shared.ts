import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Config } from "../config";
import type { Repository } from "../repositories/memory";
import { ApiError } from "../errors";
import { CommerceService } from "../domain/commerce";
import { CatalogService } from "../domain/catalog";
import { SessionService } from "../domain/sessions";
export type Context = {
  config: Config;
  repo: Repository;
  commerce: CommerceService;
  catalog: CatalogService;
  sessions: SessionService;
  now: () => number;
};
export function result(
  request: FastifyRequest,
  reply: FastifyReply,
  data: unknown,
  status = 200,
) {
  return reply.code(status).send({
    data,
    requestId: request.id,
    meta: { mode: "demo", storage: "memory" },
  });
}
export function params(request: FastifyRequest) {
  return z.record(z.string(), z.string()).parse(request.params);
}
export function idempotencyKey(request: FastifyRequest) {
  return typeof request.headers["idempotency-key"] === "string"
    ? request.headers["idempotency-key"]
    : "";
}
export function unavailableProvider() {
  throw new ApiError(
    503,
    "provider_not_configured",
    "Live identity, Razorpay and webhook processing are disabled with in-memory storage. Use explicitly labelled demo endpoints. No real transaction was attempted.",
  );
}
export type RouteModule = (app: FastifyInstance, context: Context) => void;
