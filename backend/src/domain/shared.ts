import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type { State, Order } from "../contracts";
import { ApiError } from "../errors";
export const makeId = (prefix: string) => `${prefix}_${randomUUID()}`;
export const token = () => randomBytes(32).toString("base64url");
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function sameSecret(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export const iso = (now: number) => new Date(now).toISOString();
export function ownOrder(state: Readonly<State>, ownerId: string, id: string) {
  const order = state.orders.get(id);
  if (!order || order.ownerId !== ownerId)
    throw new ApiError(404, "not_found", "Order not found");
  return order;
}
export function releaseResources(state: State, order: Order) {
  if (order.resourcesReleased) return;
  for (const line of order.lines) {
    const p = state.products.get(line.id);
    if (p) p.stock += line.quantity;
  }
  order.resourcesReleased = true;
}
export function expireReservations(state: State, now: number) {
  for (const order of state.orders.values()) {
    if (
      order.fulfillment === "awaiting_payment" &&
      Date.parse(order.reservationExpiresAt) <= now
    ) {
      releaseResources(state, order);
      order.fulfillment = "expired";
      order.updatedAt = iso(now);
      order.version++;
    }
  }
}
export function idempotent<T>(
  state: State,
  ownerId: string,
  operation: string,
  key: string,
  body: unknown,
  now: number,
  execute: () => T,
): T {
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(key))
    throw new ApiError(
      400,
      "idempotency_key_required",
      "Provide an Idempotency-Key header containing 8–100 letters, digits, underscores or hyphens",
    );
  const mapKey = `${ownerId}:${operation}:${key}`;
  const fingerprint = digest(JSON.stringify(body));
  const previous = state.idempotency.get(mapKey);
  if (previous && previous.expiresAt > now) {
    if (previous.fingerprint !== fingerprint)
      throw new ApiError(
        409,
        "idempotency_conflict",
        "This key was already used with different input",
      );
    return structuredClone(previous.result) as T;
  }
  const result = execute();
  state.idempotency.set(mapKey, {
    fingerprint,
    result: structuredClone(result),
    expiresAt: now + 24 * 60 * 60 * 1000,
  });
  return result;
}
export function page<T>(items: T[], pageNumber: number, limit: number) {
  return {
    items: items.slice((pageNumber - 1) * limit, pageNumber * limit),
    page: pageNumber,
    limit,
    total: items.length,
    hasMore: pageNumber * limit < items.length,
  };
}
