import type { FastifyRequest, FastifyReply } from "fastify";
import type { Repository } from "../repositories/memory";
import type { Config } from "../config";
import type { Session } from "../contracts";
import { ApiError } from "../errors";
import {
  token,
  digest,
  makeId,
  sameSecret,
  expireReservations,
  releaseResources,
} from "./shared";
export const COOKIE = "kg_api_session";
export class SessionService {
  constructor(
    private repo: Repository,
    private config: Config,
    private now: () => number = Date.now,
  ) {}
  async start(
    reply: FastifyReply,
    previousToken?: string,
    kind: Session["kind"] = "guest",
  ) {
    return this.repo.transaction((s) => {
      if (s.sessions.size >= 1000)
        throw new ApiError(
          503,
          "capacity_reached",
          "Demo server session capacity reached",
        );
      const previous = previousToken
        ? s.sessions.get(digest(previousToken))
        : undefined;
      const valid =
        previous && previous.expiresAt > this.now() ? previous : undefined;
      if (previousToken) s.sessions.delete(digest(previousToken));
      const secret = token();
      const session: Session = {
        id: valid?.id ?? makeId("session"),
        kind,
        csrfToken: token(),
        expiresAt: this.now() + this.config.sessionTtlMs,
      };
      s.sessions.set(digest(secret), session);
      reply.setCookie(COOKIE, secret, {
        httpOnly: true,
        sameSite: "strict",
        secure: this.config.secureCookies,
        path: "/",
        maxAge: Math.floor(this.config.sessionTtlMs / 1000),
      });
      return session;
    });
  }
  async require(request: FastifyRequest, customer = false) {
    const secret = request.cookies[COOKIE];
    if (!secret)
      throw new ApiError(
        401,
        "unauthorized",
        "Start a guest or demo-customer session",
      );
    const session = await this.repo.read((s) => s.sessions.get(digest(secret)));
    if (!session || session.expiresAt <= this.now())
      throw new ApiError(
        401,
        "session_expired",
        "Session expired or backend restarted",
      );
    if (customer && session.kind !== "demo_customer")
      throw new ApiError(
        403,
        "customer_required",
        "Continue as a demo customer to use the address book",
      );
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const csrf = request.headers["x-csrf-token"];
      if (typeof csrf !== "string" || !sameSecret(csrf, session.csrfToken))
        throw new ApiError(
          403,
          "csrf_failed",
          "Missing or invalid X-CSRF-Token",
        );
    }
    return session;
  }
  async logout(request: FastifyRequest, reply: FastifyReply) {
    await this.require(request);
    const secret = request.cookies[COOKIE];
    await this.repo.transaction((s) => {
      if (secret) s.sessions.delete(digest(secret));
    });
    reply.clearCookie(COOKIE, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: this.config.secureCookies,
    });
    return { signedOut: true };
  }
  async cleanup() {
    await this.repo.transaction((s) => {
      const now = this.now();
      expireReservations(s, now);
      for (const [key, value] of s.sessions)
        if (value.expiresAt <= now) s.sessions.delete(key);
      const owners = new Set([...s.sessions.values()].map((s) => s.id));
      for (const [id, order] of s.orders) {
        if (!owners.has(order.ownerId)) {
          if (
            !["captured", "refund_requested", "refunded"].includes(
              order.paymentStatus,
            )
          )
            releaseResources(s, order);
          s.orders.delete(id);
        }
      }
      for (const map of [s.quotes, s.attempts, s.addresses, s.contacts])
        for (const [id, value] of map)
          if (!owners.has(value.ownerId)) map.delete(id);
      for (const [id, quote] of s.quotes)
        if (Date.parse(quote.expiresAt) <= now) s.quotes.delete(id);
      for (const map of [s.carts, s.wishlists])
        for (const owner of map.keys())
          if (!owners.has(owner)) map.delete(owner);
      for (const [key, record] of s.idempotency)
        if (record.expiresAt <= now || !owners.has(key.split(":")[0] ?? ""))
          s.idempotency.delete(key);
      for (const [key, cap] of s.capabilities)
        if (cap.expiresAt <= now || !s.orders.has(cap.orderId))
          s.capabilities.delete(key);
    });
  }
}
