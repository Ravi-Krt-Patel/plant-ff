"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { z } from "zod";
import { RefreshCw, Package } from "lucide-react";
import { apiRequest, ApiError } from "@/features/delivery/api";
import {
  backendOrderSchema,
  trackingSchema,
  type BackendOrder,
  type TrackingSnapshot,
} from "@/features/delivery/contracts";
import { LocationMap } from "@/features/delivery/location-map";
import { money } from "@/mocks/catalog";
import { coordinates, DeliveryDestination } from "./delivery-destination";

const orderIdSchema = z.string().uuid();
const guestChallengeSchema = z.object({
  challengeId: z.string().min(1),
  expiresInSeconds: z.number().positive(),
  delivery: z.string(),
});
const guestGrantSchema = z.object({
  accessGranted: z.literal(true),
  expiresInSeconds: z.number().positive(),
});
const orderPageSchema = z.object({
  items: z.array(backendOrderSchema),
  nextCursor: z.string().nullable(),
});
const statusLabels: Record<string, string> = {
  awaiting_payment: "Awaiting payment",
  confirmed: "Order placed",
  preparing: "Processing",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  expired: "Order expired",
};
const terminalStatuses = new Set(["delivered", "cancelled", "expired"]);
function statusLabel(status: string) {
  return statusLabels[status] ?? status.replaceAll("_", " ");
}
function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time unavailable"
    : date.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
      }) + " IST";
}
function inaccessible(error: unknown) {
  return error instanceof ApiError && [401, 403, 404].includes(error.status);
}
function requestError(error: unknown) {
  if (inaccessible(error))
    return "This order is unavailable in your current session. Sign in with the account used to place it, or use the original checkout session.";
  return "We couldn’t get the latest order information. Please try again.";
}

export function TrackingContent({
  order,
  tracking,
}: {
  order: BackendOrder;
  tracking: TrackingSnapshot;
}) {
  const address = tracking.destination ?? order.snapshot.input?.address;
  const destination = coordinates(address);
  const location = tracking.location;
  const simulatedLocation =
    tracking.simulation ||
    location?.source === "simulation" ||
    location?.source === "simulated";
  const rider =
    tracking.status === "out_for_delivery" && !simulatedLocation
      ? coordinates(location)
      : null;
  const riderLabel = location?.stale
    ? "Last known delivery-agent location (stale)"
    : "Latest reported delivery-agent location";
  return (
    <div className="two-columns" style={{ alignItems: "start" }}>
      <section className="panel" style={{ minWidth: 0 }}>
        <div className="summary-row">
          <span>Order status</span>
          <strong>{statusLabel(tracking.status)}</strong>
        </div>
        {tracking.simulation && (
          <p className="message">
            Demo order · delivery updates are simulated. No actual delivery is
            in progress.
          </p>
        )}
        {tracking.estimatedDelivery && (
          <p>
            <strong>Estimated delivery:</strong>{" "}
            {Number.isNaN(Date.parse(tracking.estimatedDelivery))
              ? tracking.estimatedDelivery
              : dateLabel(tracking.estimatedDelivery)}
          </p>
        )}
        {tracking.timeline.length > 0 ? (
          <ol className="timeline" aria-label="Order status history">
            {tracking.timeline.map((event, index) => (
              <li
                className="done"
                key={`${event.status}-${event.createdAt}-${index}`}
              >
                <strong>{statusLabel(event.status)}</strong>
                <time dateTime={event.createdAt}>
                  {dateLabel(event.createdAt)}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p>Status history is not available for this order.</p>
        )}
        <h2>Delivery map</h2>
        {!destination && (
          <p className="message">No delivery pin saved for this order.</p>
        )}
        {(destination || rider) && (
          <LocationMap
            destination={destination}
            rider={rider}
            riderLabel={riderLabel}
            destinationLabel="Your delivery destination"
          />
        )}
        {rider && location ? (
          <div style={{ fontSize: 13, marginTop: 16 }}>
            <p>
              <strong>{riderLabel}</strong>
            </p>
            <p>
              Recorded {dateLabel(location.recordedAt)} · accuracy approximately{" "}
              {Math.round(location.accuracy)} metres.
            </p>
            {location.stale && (
              <p role="status">
                This location is stale and may no longer reflect where the
                delivery agent is.
              </p>
            )}
            <p>
              This is the latest reported position. The marker moves only when
              the delivery system receives another location update.
            </p>
          </div>
        ) : (
          <p className="message">
            {location && simulatedLocation
              ? "Only simulated delivery-agent data is available. A real delivery-agent position is not shown."
              : "No delivery-agent location is currently available."}{" "}
            Your latest order status is shown above.
          </p>
        )}
      </section>
      <aside className="panel summary-panel" style={{ minWidth: 0 }}>
        <h2 style={{ overflowWrap: "anywhere" }}>{order.reference}</h2>
        <p style={{ fontSize: 12, overflowWrap: "anywhere" }}>
          Order ID: {order.id}
        </p>
        <div className="summary-row">
          <span>Order total</span>
          <strong>{money(order.totalPaise)}</strong>
        </div>
        <p>
          Payment: {order.method.toUpperCase()} ·{" "}
          {order.paymentState.replaceAll("_", " ")}
        </p>
        <DeliveryDestination address={address} />
        <Link href="/account/orders" className="text-link">
          View your orders →
        </Link>
      </aside>
    </div>
  );
}

export function TrackingOrder({ orderId }: { orderId: string }) {
  const [recoverable, setRecoverable] = useState(false);
  const [data, setData] = useState<{
    order: BackendOrder;
    tracking: TrackingSnapshot;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const refresh = useRef<() => void>(() => undefined);
  useEffect(() => {
    let disposed = false;
    let blocked = false;
    let ended = false;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async (manual = false) => {
      clearTimeout(timer);
      if (disposed || document.hidden || (blocked && !manual)) return;
      controller?.abort();
      const request = new AbortController();
      controller = request;
      setBusy(true);
      try {
        const [order, tracking] = await Promise.all([
          apiRequest(
            `/orders/${encodeURIComponent(orderId)}`,
            backendOrderSchema,
            { signal: request.signal },
          ),
          apiRequest(
            `/orders/${encodeURIComponent(orderId)}/tracking`,
            trackingSchema,
            { signal: request.signal },
          ),
        ]);
        if (disposed || request.signal.aborted) return;
        setData({ order, tracking });
        setError("");
        setCheckedAt(new Date().toISOString());
        blocked = false;
        setRecoverable(false);
        ended = terminalStatuses.has(tracking.status);
      } catch (cause) {
        if (
          disposed ||
          request.signal.aborted ||
          (cause instanceof Error && cause.name === "AbortError")
        )
          return;
        setError(requestError(cause));
        blocked = inaccessible(cause);
        setRecoverable(blocked);
        if (blocked) setData(null);
      } finally {
        if (!disposed && !request.signal.aborted) {
          setBusy(false);
          if (!blocked && !ended && !document.hidden)
            timer = setTimeout(() => void load(), 15_000);
        }
      }
    };
    refresh.current = () => void load(true);
    const visibility = () => {
      if (document.hidden) {
        clearTimeout(timer);
        controller?.abort();
      } else if (!ended) void load();
    };
    document.addEventListener("visibilitychange", visibility);
    void load();
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", visibility);
      refresh.current = () => undefined;
    };
  }, [orderId]);
  return (
    <div className="page wrap">
      <p className="eyebrow">YOUR LITTLE GREEN JOURNEY</p>
      <h1 className="page-title">Follow your green.</h1>
      <p className="page-intro">
        Your saved destination and the latest delivery updates.
      </p>
      {error && (
        <div className="message" role="alert">
          <p>{error}</p>
          {!data && (
            <Link href="/account" className="text-link">
              Go to your account →
            </Link>
          )}
        </div>
      )}
      {recoverable && !data && (
        <GuestOrderRecovery
          orderId={orderId}
          onVerified={() => refresh.current()}
        />
      )}
      {busy && !data && (
        <p role="status">Loading your order and delivery information…</p>
      )}
      {data && <TrackingContent order={data.order} tracking={data.tracking} />}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          margin: "24px 0",
        }}
      >
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => refresh.current()}
        >
          <RefreshCw size={16} />{" "}
          {busy ? "Checking…" : "Refresh delivery status"}
        </button>
        {checkedAt && data && (
          <p style={{ fontSize: 13 }}>
            Last checked {dateLabel(checkedAt)}.{" "}
            {!terminalStatuses.has(data.tracking.status) &&
              "Updates are checked every 15 seconds while this page is visible."}
          </p>
        )}
      </div>
      <Link href="/track-order" className="text-link">
        Look up another order →
      </Link>
    </div>
  );
}

export function ApiTrackingPage() {
  const params = useSearchParams();
  const router = useRouter();
  const orderId = params.get("orderId");
  const [input, setInput] = useState("");
  const [validation, setValidation] = useState("");
  if (orderId && orderIdSchema.safeParse(orderId).success)
    return <TrackingOrder key={orderId} orderId={orderId} />;
  return (
    <div className="page wrap">
      <div className="article">
        <p className="eyebrow">FROM OUR GREEN CORNER TO YOURS</p>
        <h1>Where’s my little green?</h1>
        <p>
          Open an order from your account, or enter its order ID. You can view
          only orders linked to your account or checkout session.
        </p>
        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = orderIdSchema.safeParse(input.trim());
            if (!parsed.success) {
              setValidation(
                "Enter the complete order ID from your order confirmation.",
              );
              return;
            }
            setValidation("");
            router.push(
              `/track-order?orderId=${encodeURIComponent(parsed.data)}`,
            );
          }}
        >
          <label htmlFor="tracking-order-id">Order ID</label>
          <input
            id="tracking-order-id"
            autoComplete="off"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Order ID from your confirmation"
            style={{ display: "block", width: "100%", margin: "10px 0 20px" }}
            aria-describedby={
              validation || orderId ? "tracking-validation" : undefined
            }
          />
          {(validation || orderId) && (
            <p role="alert" id="tracking-validation">
              {validation ||
                "This tracking link does not contain a valid order ID."}
            </p>
          )}
          <button className="button full-width">Find my order</button>
          <Link href="/account/orders" className="text-link">
            Choose from your orders →
          </Link>
        </form>
        <details style={{ marginTop: 24 }}>
          <summary>Placed an order as a guest on another device?</summary>
          <GuestOrderRecovery
            onVerified={(id) =>
              router.push(`/track-order?orderId=${encodeURIComponent(id)}`)
            }
          />
        </details>
      </div>
    </div>
  );
}

export function ApiOrderList() {
  const [orders, setOrders] = useState<BackendOrder[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    const path = `/orders?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    void apiRequest(path, orderPageSchema, { signal: controller.signal })
      .then((page) => {
        if (controller.signal.aborted) return;
        setOrders((previous) =>
          cursor
            ? [
                ...previous.filter(
                  (order) => !page.items.some((item) => item.id === order.id),
                ),
                ...page.items,
              ]
            : page.items,
        );
        setNextCursor(page.nextCursor);
        setError("");
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          inaccessible(cause)
            ? "Sign in with your account, or use your original checkout session, to view your orders."
            : "We couldn’t load your orders. Please try again.",
        );
        if (inaccessible(cause)) {
          setOrders([]);
          setNextCursor(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [cursor, revision]);
  return (
    <div className="page wrap">
      <h1 className="page-title">Your green journeys.</h1>
      <p className="page-intro">
        Orders placed from this account or checkout session.
      </p>
      {error && (
        <p role="alert" className="message">
          {error}
        </p>
      )}
      {busy && <p role="status">Loading your orders…</p>}
      {!busy && !error && orders.length === 0 && (
        <div className="empty-state">
          <p>No orders are linked to this account or session yet.</p>
          <Link href="/shop" className="button">
            Explore the collection
          </Link>
        </div>
      )}
      {orders.map((order) => (
        <Link
          key={order.id}
          className="panel"
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            margin: "20px 0",
            overflowWrap: "anywhere",
          }}
          href={`/track-order?orderId=${encodeURIComponent(order.id)}`}
        >
          <span>
            <Package size={18} style={{ display: "inline", marginRight: 12 }} />
            {order.reference}
            <small style={{ display: "block", marginTop: 8 }}>
              {statusLabel(order.status)} · {dateLabel(order.createdAt)}
            </small>
          </span>
          <span>{money(order.totalPaise)} · Track order →</span>
        </Link>
      ))}
      {nextCursor && !error && (
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setCursor(nextCursor);
          }}
        >
          Load more orders
        </button>
      )}
      {error && (
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setRevision((value) => value + 1);
          }}
        >
          Try again
        </button>
      )}
      <p>
        <Link href="/account" className="text-link">
          Your account →
        </Link>
      </p>
    </div>
  );
}

export function GuestOrderRecovery({
  orderId: initialOrderId = "",
  onVerified,
}: {
  orderId?: string;
  onVerified: (orderId: string) => void;
}) {
  const fieldId = useId();
  const [orderId, setOrderId] = useState(initialOrderId);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<z.infer<
    typeof guestChallengeSchema
  > | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function submit() {
    const parsedId = orderIdSchema.safeParse(orderId.trim());
    if (!parsedId.success || !/^[6-9]\d{9}$/.test(phone)) {
      setError(
        "Enter the complete order ID and the 10-digit mobile number used at checkout.",
      );
      return;
    }
    if (challenge && !/^\d{6}$/.test(code)) {
      setError("Enter the six-digit verification code.");
      return;
    }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      if (challenge) {
        await apiRequest("/guest-order-access/verify", guestGrantSchema, {
          method: "POST",
          body: { challengeId: challenge.challengeId, code },
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setCode("");
        onVerified(parsedId.data);
      } else {
        const result = await apiRequest(
          "/guest-order-access/request",
          guestChallengeSchema,
          {
            method: "POST",
            body: { orderId: parsedId.data, phone },
            signal: controller.signal,
          },
        );
        if (controller.signal.aborted) return;
        setOrderId(parsedId.data);
        setChallenge(result);
      }
    } catch (cause) {
      if (controller.signal.aborted) return;
      if (cause instanceof ApiError && cause.status === 429) {
        setError(
          "Please wait before requesting or trying another verification code.",
        );
      } else if (
        cause instanceof ApiError &&
        cause.code === "verification_failed"
      ) {
        setError(
          "The code is incorrect or expired, or these details do not match an accessible order. Check your details and try again.",
        );
      } else {
        setError("We couldn’t verify access to this order. Please try again.");
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <section
      className="panel"
      style={{ margin: "24px 0" }}
      aria-labelledby={`${fieldId}-title`}
    >
      <h2 id={`${fieldId}-title`}>Recover guest order access</h2>
      <p>
        Verify the mobile number used at checkout to view this order.
        Verification grants temporary access to this order only.
      </p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label htmlFor={`${fieldId}-order`}>Order ID</label>
        <input
          id={`${fieldId}-order`}
          value={orderId}
          autoComplete="off"
          disabled={busy || !!challenge || !!initialOrderId}
          onChange={(event) => setOrderId(event.target.value)}
          style={{ display: "block", width: "100%", margin: "8px 0 20px" }}
        />
        <label htmlFor={`${fieldId}-phone`}>
          Mobile number used at checkout
        </label>
        <input
          id={`${fieldId}-phone`}
          value={phone}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={10}
          disabled={busy || !!challenge}
          onChange={(event) => setPhone(event.target.value)}
          style={{ display: "block", width: "100%", margin: "8px 0 20px" }}
        />
        {challenge && (
          <>
            <div className="message" role="status">
              {challenge.delivery === "local_outbox" ? (
                <>
                  <p>
                    SMS delivery is not enabled in this environment. A local
                    developer can retrieve the verification code on the backend
                    machine.
                  </p>
                  <details>
                    <summary>Local development code retrieval</summary>
                    <p>Run this command in the backend folder:</p>
                    <code
                      style={{
                        display: "block",
                        overflowWrap: "anywhere",
                        whiteSpace: "normal",
                      }}
                    >
                      pnpm dev:otp {challenge.challengeId}
                    </code>
                    <p>
                      Challenge ID:{" "}
                      <span style={{ overflowWrap: "anywhere" }}>
                        {challenge.challengeId}
                      </span>
                    </p>
                  </details>
                </>
              ) : (
                <p>
                  If the details are eligible, a verification code has been
                  queued for delivery.
                </p>
              )}
              <p>
                The code expires {Math.ceil(challenge.expiresInSeconds / 60)}{" "}
                minutes after it was requested.
              </p>
            </div>
            <label htmlFor={`${fieldId}-code`}>Verification code</label>
            <input
              id={`${fieldId}-code`}
              value={code}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              disabled={busy}
              onChange={(event) => setCode(event.target.value)}
              style={{ display: "block", width: "100%", margin: "8px 0 20px" }}
            />
          </>
        )}
        {error && (
          <p role="alert" className="message">
            {error}
          </p>
        )}
        <button className="button" type="submit" disabled={busy}>
          {busy
            ? "Please wait…"
            : challenge
              ? "Verify and track order"
              : "Request verification code"}
        </button>
        {challenge && (
          <button
            className="text-button"
            type="button"
            disabled={busy}
            style={{ margin: "16px 0", display: "block" }}
            onClick={() => {
              setChallenge(null);
              setCode("");
              setError("");
            }}
          >
            Change details or request a new code
          </button>
        )}
      </form>
    </section>
  );
}
