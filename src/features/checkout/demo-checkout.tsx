"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type PaymentStatus } from "@/contracts";
import {
  deliveryAddressSchema as addressSchema,
  type DeliveryAddress as Address,
} from "@/features/delivery/contracts";
import {
  editableAddress,
  AddressFields,
} from "@/features/delivery/address-fields";
import { useStore } from "@/features/cart/store";
import { quote, isServiceable } from "@/mocks/services";
import { getProduct, money } from "@/mocks/catalog";
const Payment = dynamic(() => import("./payment"), {
  loading: () => (
    <p role="status" className="message">
      Preparing the demo payment…
    </p>
  ),
});
export function DemoCheckout() {
  const { lines, orders, addresses, setOrders, dispatch } = useStore();
  const router = useRouter();
  const [method, setMethod] = useState("upi");
  const [slot, setSlot] = useState("morning");
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState("");
  const [couponMessage, setCouponMessage] = useState("");
  const [error, setError] = useState("");
  const [payment, setPayment] = useState(false);
  const [orderId, setOrderId] = useState("");
  const total = quote(lines, applied);
  const form = useForm<Address>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      name: "",
      phone: "",
      line: "",
      locality: "",
      city: "Varanasi",
      state: "Uttar Pradesh",
      landmark: "",
      pin: "",
      instructions: "",
    },
  });
  const { handleSubmit, setValue } = form;
  const finish = (status: PaymentStatus, id = orderId) => {
    setOrders((s) =>
      s.map((o) => (o.id === id ? { ...o, payment: status } : o)),
    );
    setPayment(false);
    if (status === "success") dispatch({ type: "clear" });
    router.push(`/checkout/result/${id}`);
  };
  const submit = (address: Address) => {
    if (!isServiceable(address.pin)) {
      setError(
        "This address is outside the configured demo zones. Use sample PIN 221001, 221005, or 221010.",
      );
      return;
    }
    if (method === "cod" && address.pin === "221010") {
      setError(
        "Cash on delivery is unavailable in this demo zone. Select UPI or card.",
      );
      return;
    }
    setError("");
    const id =
      orderId || `KG-DEMO-${String(orders.length + 1).padStart(3, "0")}`;
    if (!orderId) {
      setOrderId(id);
      setOrders((s) => [
        ...s,
        {
          id,
          lines: [...lines],
          total: total.total,
          method,
          payment: "pending",
          fulfillment: "confirmed",
          deliveryAddress: { ...address },
        },
      ]);
    }
    if (method === "cod") finish("success", id);
    else setPayment(true);
  };
  return (
    <div className="page wrap">
      <div className="breadcrumb">
        <Link href="/cart">Your bag</Link> / A greener doorstep
      </div>
      <h1 className="page-title">Almost home.</h1>
      <p className="page-intro">
        A practice checkout for your little collection. Please use fictitious
        details.
      </p>
      {!lines.length ? (
        <div className="empty-state">
          <h2>Let’s find your green first.</h2>
          <Link className="button" href="/shop">
            Explore plants
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(submit)} noValidate>
          <div className="two-columns">
            <div>
              <section className="panel">
                <h2>01 · Your doorstep</h2>
                {addresses.length > 0 && (
                  <label>
                    Saved demo address
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const a = addresses[Number(e.target.value)];
                        if (a) form.reset(editableAddress(a));
                      }}
                    >
                      <option value="">Choose an address</option>
                      {addresses.map((a, i) => (
                        <option value={i} key={i}>
                          {a.name} · {a.line}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  className="underlined text-button"
                  style={{ marginBottom: 20 }}
                  onClick={() => {
                    const sample: Address = {
                      name: "Demo Plant Lover",
                      phone: "9000000000",
                      line: "12 Sample Garden Lane",
                      locality: "Demo locality, Varanasi",
                      landmark: "Fictional community garden",
                      pin: "221001",
                      instructions: "",
                      city: "Varanasi",
                      state: "Uttar Pradesh",
                      latitude: 25.3176,
                      longitude: 82.9739,
                    };
                    (Object.keys(sample) as (keyof Address)[]).forEach((key) =>
                      setValue(key, sample[key]),
                    );
                  }}
                >
                  Use fictional sample address
                </button>
                <AddressFields form={form} />
              </section>
              <section className="panel" style={{ marginTop: 20 }}>
                <h2>02 · A little time for delivery</h2>
                <p style={{ fontSize: 12, marginBottom: 15 }}>
                  Illustrative slots only. These are not real delivery promises.
                </p>
                <label>
                  Demo delivery slot
                  <select
                    aria-label="Delivery slot"
                    value={slot}
                    onChange={(e) => setSlot(e.target.value)}
                    style={{ width: "100%", marginTop: 8 }}
                  >
                    <option value="morning">Next demo day · 10 am–1 pm</option>
                    <option value="evening">Next demo day · 4 pm–7 pm</option>
                  </select>
                </label>
              </section>
              <section className="panel" style={{ marginTop: 20 }}>
                <h2>03 · Choose a payment method</h2>
                <div className="payment-options">
                  {["upi", "card", "cod"].map((m) => (
                    <label key={m}>
                      <input
                        type="radio"
                        name="method"
                        checked={method === m}
                        onChange={() => setMethod(m)}
                        value={m}
                      />
                      {m === "cod" ? "Cash on delivery" : m.toUpperCase()}
                    </label>
                  ))}
                </div>
                <p style={{ fontSize: 12, marginTop: 15 }}>
                  All methods are simulated. No money is charged.
                </p>
              </section>
            </div>
            <aside className="panel summary-panel">
              <h2>Your green delivery</h2>
              {lines.map((l) => (
                <div className="summary-row" key={l.id + l.variant}>
                  <span>
                    {getProduct(l.id)?.name} × {l.quantity}
                    <small style={{ display: "block" }}>{l.variant} pot</small>
                  </span>
                </div>
              ))}
              <div className="summary-row">
                <span>Subtotal</span>
                <span>{money(total.subtotal)}</span>
              </div>
              <div className="summary-row">
                <span>Demo delivery</span>
                <span>{money(total.shipping)}</span>
              </div>
              {total.discount > 0 && (
                <div className="summary-row">
                  <span>Demo savings</span>
                  <span>−{money(total.discount)}</span>
                </div>
              )}
              <div className="summary-row total">
                <strong>Total</strong>
                <strong>{money(total.total)}</strong>
              </div>
              <div className="coupon">
                <input
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  aria-label="Checkout coupon code"
                  placeholder="GROW10"
                />
                <button
                  type="button"
                  onClick={() => {
                    setApplied(coupon.toUpperCase() === "GROW10" ? coupon : "");
                    setCouponMessage(
                      coupon.toUpperCase() === "GROW10"
                        ? "10% demo discount applied."
                        : "Invalid demo coupon. Try GROW10.",
                    );
                  }}
                >
                  Apply
                </button>
              </div>
              {couponMessage && (
                <p className="message" role="status">
                  {couponMessage}
                </p>
              )}
              {error && (
                <p className="error-text message" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="button full-width">
                {method === "cod"
                  ? "Place demo order"
                  : "Continue to demo payment"}{" "}
                →
              </button>
              <p style={{ fontSize: 11, marginTop: 15 }}>
                Details remain in memory and reset on reload. By continuing, you
                are trying a demonstration, not placing a real order.
              </p>
            </aside>
          </div>
        </form>
      )}
      {payment && (
        <Payment
          orderId={orderId}
          method={method}
          onResult={finish}
          onClose={() => {
            setPayment(false);
            setError(
              "Demo payment dismissed. Your bag is safe; you can try again.",
            );
          }}
        />
      )}
    </div>
  );
}
