"use client";
import Link from "next/link";
import { useState } from "react";
import dynamic from "next/dynamic";
import { CheckCircle2, Clock, Package, XCircle } from "lucide-react";
import type { Order } from "@/contracts";
import { useStore } from "@/features/cart/store";
import { money, getProduct } from "@/mocks/catalog";
const Map = dynamic(() => import("./map"), {
  loading: () => (
    <div className="map-placeholder" role="status">
      Preparing illustrative map…
    </div>
  ),
});
import { orderIds } from "@/mocks/order-ids";
const sample: Order = {
  id: "KG-SAMPLE-001",
  lines: [{ id: "p1", variant: "nursery", quantity: 1 }],
  total: 74800,
  method: "cod",
  payment: "success",
  fulfillment: "out_for_delivery",
};
export function OrderView({
  id,
  result = false,
  tracking = false,
}: {
  id: string;
  result?: boolean;
  tracking?: boolean;
}) {
  const { orders, setOrders, signedIn } = useStore();
  const [showMap, setShowMap] = useState(false);
  const [sampleCancelled, setSampleCancelled] = useState(false);
  const order =
    id === sample.id
      ? {
          ...sample,
          fulfillment: sampleCancelled
            ? ("cancelled" as const)
            : sample.fulfillment,
        }
      : orders.find((o) => o.id === id);
  if (!order)
    return (
      <div className="page wrap empty-state">
        <h1 className="page-title">This little journey has reset.</h1>
        <p>
          New demo orders live in this tab’s memory and disappear after reload.
          The sample order is always available.
        </p>
        <Link className="button" href="/track-order/KG-SAMPLE-001">
          View sample order
        </Link>
      </div>
    );
  if (!result && !tracking && !signedIn)
    return (
      <div className="page wrap empty-state">
        <h1 className="page-title">A little privacy, please.</h1>
        <p>
          Demo access is restricted. Continue as the demo customer to view
          account orders.
        </p>
        <Link href="/account" className="button">
          Go to demo account
        </Link>
      </div>
    );
  const success = order.payment === "success";
  const pending = order.payment === "pending";
  return (
    <div className="page wrap">
      <div className="breadcrumb">
        <Link href="/shop">Home</Link> / Demo order / {id}
      </div>
      {result ? (
        <>
          <div style={{ marginBottom: 20 }}>
            {success ? (
              <CheckCircle2 size={45} />
            ) : pending ? (
              <Clock size={45} />
            ) : (
              <XCircle size={45} />
            )}
          </div>
          <h1 className="page-title">
            {success
              ? "A little joy is on its way."
              : pending
                ? "A little patience, plant friend."
                : "Let’s give that another try."}
          </h1>
          <p className="page-intro">
            {success
              ? order.method === "cod"
                ? "Demo order confirmed — payment due on delivery."
                : "Simulated payment successful — no money charged."
              : pending
                ? "Demo payment pending. Your bag is preserved; this is not a confirmed payment."
                : "Demo payment was unsuccessful or dismissed. Your bag has been preserved."}
          </p>
        </>
      ) : (
        <>
          <p className="eyebrow">YOUR LITTLE GREEN JOURNEY</p>
          <h1 className="page-title">
            {tracking ? "Follow your green." : "Your demo order."}
          </h1>
          <p className="page-intro">
            Illustrative order updates only. No actual delivery is in progress.
          </p>
        </>
      )}
      <div className="two-columns">
        <section className="panel">
          <h2>{id}</h2>
          <div className="summary-row">
            <span>Status</span>
            <strong>{order.fulfillment.replaceAll("_", " ")}</strong>
          </div>
          {order.fulfillment === "cancelled" ? (
            <p className="message">
              Demo cancellation recorded. No real refund is needed.
            </p>
          ) : (
            <ol className="timeline">
              {[
                "Order confirmed",
                "Getting your greens ready",
                "Out for demo delivery",
                "Delivered",
              ].map((label, i) => (
                <li
                  className={
                    i <=
                    (order.fulfillment === "out_for_delivery"
                      ? 2
                      : order.fulfillment === "delivered"
                        ? 3
                        : 0)
                      ? "done"
                      : ""
                  }
                  key={label}
                >
                  <strong>{label}</strong>
                  <span>
                    {i === 2
                      ? "Demo estimate · illustrative only"
                      : i === 0
                        ? "Your sample collection is noted"
                        : "A step in the simulated journey"}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {!showMap ? (
            <button
              className="button secondary"
              onClick={() => setShowMap(true)}
            >
              Show tracking map
            </button>
          ) : (
            <Map />
          )}
          <p style={{ fontSize: 11, marginTop: 15 }}>
            Seeded snapshot · 20 September 2026, 10:30 am IST. Not live
            tracking.
          </p>
        </section>
        <aside className="panel summary-panel">
          <h2>Your collection</h2>
          {order.lines.map((l) => (
            <div className="summary-row" key={l.id + l.variant}>
              <span>
                {getProduct(l.id)?.name} × {l.quantity}
              </span>
            </div>
          ))}
          <div className="summary-row total">
            <span>Demo total</span>
            <strong>{money(order.total)}</strong>
          </div>
          <p style={{ fontSize: 13 }}>
            Method: {order.method.toUpperCase()} ·{" "}
            {order.method === "cod" ? "due on delivery" : order.payment}
          </p>
          {!success && (
            <Link href="/checkout" className="button full-width">
              Return to checkout
            </Link>
          )}
          <Link
            href={`/track-order/${id}`}
            className="button full-width secondary"
          >
            Track demo order
          </Link>
          {order.fulfillment !== "cancelled" &&
            order.fulfillment !== "delivered" && (
              <button
                className="text-button"
                style={{ marginTop: 25 }}
                onClick={() => {
                  if (id === sample.id) setSampleCancelled(true);
                  else
                    setOrders((s) =>
                      s.map((o) =>
                        o.id === id ? { ...o, fulfillment: "cancelled" } : o,
                      ),
                    );
                }}
              >
                Cancel this demo order
              </button>
            )}
        </aside>
      </div>
      <Link href="/shop" className="text-link">
        ← Keep growing your collection
      </Link>
    </div>
  );
}
export function TrackingLookup() {
  const [id, setId] = useState("");
  const [message, setMessage] = useState("");
  return (
    <div className="page wrap">
      <div className="article">
        <p className="eyebrow">FROM OUR GREEN CORNER TO YOURS</p>
        <h1>Where’s my little green?</h1>
        <p>
          Follow a simulated journey with the sample order KG-SAMPLE-001. No
          real order or phone number is needed.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(
              "That demo order was not found, or is not available in this session.",
            );
          }}
          className="panel"
        >
          <label>
            Demo order number
            <input
              style={{ display: "block", width: "100%", marginTop: 10 }}
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="KG-SAMPLE-001"
            />
          </label>
          {orderIds.includes(id) ? (
            <Link className="button full-width" href={`/track-order/${id}`}>
              Track demo order
            </Link>
          ) : (
            <button className="button full-width">Find my order</button>
          )}
          {message && <p role="alert">{message}</p>}
          <Link className="text-link" href="/track-order/KG-SAMPLE-001">
            Just exploring? Follow the sample order →
          </Link>
        </form>
      </div>
    </div>
  );
}
export function OrderList() {
  const { signedIn, orders } = useStore();
  return (
    <div className="page wrap">
      <h1 className="page-title">Your green journeys.</h1>
      {!signedIn ? (
        <div className="empty-state">
          <p>Sign in as the demo customer to explore order history.</p>
          <Link className="button" href="/account">
            Demo account
          </Link>
        </div>
      ) : (
        <>
          {[sample, ...orders].map((o) => (
            <Link
              key={o.id}
              className="panel"
              style={{
                display: "flex",
                justifyContent: "space-between",
                margin: "20px 0",
              }}
              href={`/account/orders/${o.id}`}
            >
              <span>
                <Package style={{ display: "inline", marginRight: 12 }} />
                {o.id}
              </span>
              <span>{money(o.total)} · View order →</span>
            </Link>
          ))}
        </>
      )}
    </div>
  );
}
