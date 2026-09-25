"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useStore } from "@/features/cart/store";
import {
  apiRequest,
  errorMessage,
  idempotencyKey,
} from "@/features/delivery/api";
import {
  AddressFields,
  blankAddress,
  editableAddress,
} from "@/features/delivery/address-fields";
import {
  deliveryAddressSchema,
  savedAddressSchema,
  sessionSchema,
  serviceabilitySchema,
  quoteSchema,
  backendOrderSchema,
  type DeliveryAddress,
  type SavedAddress,
  type CheckoutQuote,
} from "@/features/delivery/contracts";
import { money, getProduct } from "@/mocks/catalog";
import type { PaymentStatus } from "@/contracts";
const Payment = dynamic(() => import("./payment"), {
  loading: () => <p role="status">Preparing payment…</p>,
});
export function ApiCheckout() {
  const { lines, dispatch } = useStore(),
    router = useRouter();
  const form = useForm<DeliveryAddress>({
    resolver: zodResolver(deliveryAddressSchema),
    defaultValues: blankAddress,
  });
  const [addresses, setAddresses] = useState<SavedAddress[]>([]),
    [selected, setSelected] = useState(""),
    [signedIn, setSignedIn] = useState(false),
    [method, setMethod] = useState("cod"),
    [slot, setSlot] = useState(""),
    [coupon, setCoupon] = useState(""),
    [zone, setZone] = useState<z.infer<typeof serviceabilitySchema> | null>(
      null,
    ),
    [checkedPin, setCheckedPin] = useState(""),
    [quoted, setReview] = useState<CheckoutQuote | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [orderId, setOrderId] = useState(""),
    [payment, setPayment] = useState(false);
  const orderKey = useRef(""),
    paymentKey = useRef("");
  const formValues = useWatch({ control: form.control });
  const pin = formValues.pin ?? "";
  const [reviewedInput, setReviewedInput] = useState("");
  const inputFingerprint = JSON.stringify([
    formValues,
    lines,
    method,
    slot,
    coupon,
  ]);
  const review = reviewedInput === inputFingerprint ? quoted : null;
  useEffect(() => {
    const controller = new AbortController();
    apiRequest("/auth/session", sessionSchema, { signal: controller.signal })
      .then(async (session) => {
        if (controller.signal.aborted) return;
        setSignedIn(!!session.userId);
        if (session.userId) {
          const rows = await apiRequest(
            "/addresses",
            z.array(savedAddressSchema),
            { signal: controller.signal },
          );
          if (controller.signal.aborted) return;
          setAddresses(rows);
          const preferred = rows.find((x) => x.isDefault);
          if (preferred && !form.formState.isDirty) {
            setSelected(preferred.id);
            form.reset(editableAddress(preferred.value));
          }
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      });
    return () => controller.abort();
  }, [form]);

  async function checkDelivery() {
    setError("");
    setNotice("");
    if (!/^\d{6}$/.test(pin)) {
      setError("Enter a six-digit PIN code before checking delivery.");
      return;
    }
    setBusy(true);
    setReview(null);
    try {
      const result = await apiRequest(
        "/serviceability/check",
        serviceabilitySchema,
        { method: "POST", body: { pin } },
      );
      setZone(result);
      setCheckedPin(pin);
      setSlot(result.slots[0]?.id ?? "");
      if (!result.eligible)
        setError("This address is outside our configured delivery areas.");
      else if (!result.slots.length)
        setError("No delivery slots are available. Please try again later.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function saveAddress(address: DeliveryAddress) {
    setBusy(true);
    setError("");
    try {
      const row = await apiRequest(
        selected ? "/addresses/" + encodeURIComponent(selected) : "/addresses",
        savedAddressSchema,
        { method: selected ? "PATCH" : "POST", body: address },
      );
      const rows = await apiRequest("/addresses", z.array(savedAddressSchema));
      setAddresses(rows);
      setSelected(row.id);
      form.reset(editableAddress(row.value));
      setNotice("Address and delivery pin saved.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function getQuote(address: DeliveryAddress) {
    setError("");
    setNotice("");
    if (!zone?.eligible || checkedPin !== address.pin || !slot) {
      setError(
        "Check delivery availability and choose a slot for this PIN first.",
      );
      return;
    }
    setBusy(true);
    try {
      const input = {
        lines: lines.map((l) => ({
          variantId: l.id + "-" + l.variant,
          quantity: l.quantity,
        })),
        address,
        slotId: slot,
        method,
        ...(coupon.trim() ? { coupon: coupon.trim().toUpperCase() } : {}),
      };
      const result = await apiRequest("/checkout/quotes", quoteSchema, {
        method: "POST",
        body: input,
      });
      setReviewedInput(inputFingerprint);
      setReview(result);
      orderKey.current = idempotencyKey();
      paymentKey.current = idempotencyKey();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function placeOrder() {
    if (!review) return;
    setError("");
    setBusy(true);
    try {
      let id = orderId;
      if (!id) {
        const order = await apiRequest("/orders", backendOrderSchema, {
          method: "POST",
          body: { quoteId: review.id, version: review.version },
          idempotencyKey: orderKey.current,
        });
        id = order.id;
        setOrderId(id);
        if (order.method === "cod") {
          dispatch({ type: "clear" });
          router.push("/track-order?orderId=" + encodeURIComponent(id));
          return;
        }
      }
      const session = await apiRequest(
        "/orders/" + encodeURIComponent(id) + "/payment-sessions",
        z.object({
          id: z.string(),
          mode: z.string(),
          state: z.string(),
          providerOrderId: z.string().nullable(),
        }),
        { method: "POST", body: {}, idempotencyKey: paymentKey.current },
      );
      if (session.mode !== "fake") {
        setError(
          "Your order is saved. Hosted payment checkout is not enabled in this storefront yet; no payment has been taken.",
        );
        return;
      }
      if (!session.providerOrderId) {
        setError(
          "The payment session is still being prepared. Retry without creating a new order.",
        );
        return;
      }
      setPayment(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function simulate(status: PaymentStatus): Promise<PaymentStatus> {
    if (status === "dismissed") return status;
    const result = await apiRequest(
      "/orders/" + encodeURIComponent(orderId) + "/payments/simulate",
      z.object({ state: z.string() }),
      {
        method: "POST",
        body: {
          outcome:
            status === "success"
              ? "captured"
              : status === "failure"
                ? "failed"
                : "pending",
        },
      },
    );
    return result.state === "captured"
      ? "success"
      : status === "failure"
        ? "failure"
        : "pending";
  }
  function finish(status: PaymentStatus) {
    setPayment(false);
    if (status !== "success") {
      if (status === "failure") paymentKey.current = idempotencyKey();
      setError(
        status === "pending"
          ? "Payment is pending. Your order is saved; use its tracking link to check the latest status."
          : status === "failure"
            ? "Payment failed. Your bag is safe; continue payment to retry this same order."
            : "Payment dismissed. Your order is saved; continue payment when ready.",
      );
      return;
    }
    dispatch({ type: "clear" });
    router.push("/track-order?orderId=" + encodeURIComponent(orderId));
  }
  const locked = busy || !!orderId;
  return (
    <div className="page wrap">
      <div className="breadcrumb">
        <Link href="/cart">Your bag</Link> / Delivery
      </div>
      <h1 className="page-title">Almost home.</h1>
      <p className="page-intro">
        Choose your doorstep and check your delivery details before confirming
        the order.
      </p>
      {!lines.length && !orderId ? (
        <div className="empty-state">
          <h2>Let’s find your green first.</h2>
          <Link className="button" href="/shop">
            Explore plants
          </Link>
        </div>
      ) : (
        <div className="two-columns">
          <div>
            <form
              onSubmit={(event) => void form.handleSubmit(getQuote)(event)}
              noValidate
            >
              <section className="panel">
                <h2>01 · Your doorstep</h2>
                {signedIn ? (
                  <>
                    <label>
                      Saved delivery address
                      <select
                        disabled={locked}
                        value={selected}
                        onChange={(e) => {
                          setSelected(e.target.value);
                          setReview(null);
                          const row = addresses.find(
                            (x) => x.id === e.target.value,
                          );
                          form.reset(
                            row ? editableAddress(row.value) : blankAddress,
                          );
                        }}
                      >
                        <option value="">Add a new address</option>
                        {addresses.map((row) => (
                          <option value={row.id} key={row.id}>
                            {row.value.name} · {row.value.line}
                            {row.isDefault ? " (default)" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="message">
                      You can edit the selected details below.{" "}
                      <Link href="/account/addresses" className="underlined">
                        Manage saved addresses
                      </Link>
                    </p>
                  </>
                ) : (
                  <p className="message">
                    Checking out as a guest. Your address is saved with this
                    order.{" "}
                    <Link href="/account" className="underlined">
                      Sign in
                    </Link>{" "}
                    to keep an address book.
                  </p>
                )}
                <AddressFields form={form} disabled={locked} />
                {signedIn && (
                  <button
                    type="button"
                    className="button secondary"
                    disabled={locked}
                    onClick={form.handleSubmit(saveAddress)}
                  >
                    {selected ? "Save address changes" : "Save to my addresses"}
                  </button>
                )}
              </section>
              <section className="panel delivery-section">
                <h2>02 · Delivery availability</h2>
                <button
                  type="button"
                  className="button secondary"
                  disabled={locked}
                  onClick={checkDelivery}
                >
                  Check delivery availability
                </button>
                {zone?.eligible && checkedPin === pin && (
                  <>
                    <p className="message">
                      {zone.demo
                        ? "Sample delivery rules are configured. "
                        : ""}
                      Times are shown in India Standard Time.
                    </p>
                    <label>
                      Delivery slot
                      <select
                        value={slot}
                        disabled={locked}
                        onChange={(e) => {
                          setSlot(e.target.value);
                          setReview(null);
                        }}
                      >
                        {!zone.slots.length && (
                          <option value="">No slots available</option>
                        )}
                        {zone.slots.map((s) => (
                          <option key={s.id} value={s.id}>
                            {new Date(s.startsAt).toLocaleString("en-IN", {
                              timeZone: "Asia/Kolkata",
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
              </section>
              <section className="panel delivery-section">
                <h2>03 · Payment</h2>
                <div className="payment-options">
                  {["cod", "upi", "card"].map((m) => (
                    <label key={m}>
                      <input
                        type="radio"
                        name="payment-method"
                        value={m}
                        checked={method === m}
                        disabled={
                          locked || (m === "cod" && zone?.cod === false)
                        }
                        onChange={() => {
                          setMethod(m);
                          setReview(null);
                        }}
                      />
                      {m === "cod" ? "Cash on delivery" : m.toUpperCase()}
                    </label>
                  ))}
                </div>
                <label className="delivery-section">
                  Coupon (optional)
                  <input
                    value={coupon}
                    disabled={locked}
                    onChange={(e) => {
                      setCoupon(e.target.value);
                      setReview(null);
                    }}
                  />
                </label>
              </section>
              {!orderId && (
                <button
                  className="button delivery-section"
                  type="submit"
                  disabled={busy}
                >
                  {busy ? "Checking…" : "Review delivery and total"}
                </button>
              )}
            </form>
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
            {review ? (
              <>
                <div className="summary-row">
                  <span>Subtotal</span>
                  <span>{money(review.totals.subtotalPaise)}</span>
                </div>
                <div className="summary-row">
                  <span>Delivery</span>
                  <span>{money(review.totals.shippingPaise)}</span>
                </div>
                {review.totals.discountPaise > 0 && (
                  <div className="summary-row">
                    <span>Savings</span>
                    <span>−{money(review.totals.discountPaise)}</span>
                  </div>
                )}
                <div className="summary-row total">
                  <strong>Total</strong>
                  <strong>{money(review.totals.totalPaise)}</strong>
                </div>
                <p className="message">
                  Review the address, pin, and slot. This total expires at{" "}
                  {new Date(review.expiresAt).toLocaleTimeString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  })}{" "}
                  IST.
                </p>
                <button
                  type="button"
                  className="button full-width"
                  disabled={busy}
                  onClick={placeOrder}
                >
                  {busy
                    ? "Please wait…"
                    : orderId
                      ? "Continue payment"
                      : "Confirm order · " + money(review.totals.totalPaise)}
                </button>
              </>
            ) : (
              <p className="message">
                Review delivery to obtain the current total from the store.
              </p>
            )}
            {orderId && (
              <Link
                className="underlined delivery-section"
                href={"/track-order?orderId=" + encodeURIComponent(orderId)}
              >
                View saved order
              </Link>
            )}
            {notice && (
              <p role="status" className="message">
                {notice}
              </p>
            )}
            {error && (
              <p role="alert" className="error-text message">
                {error}
              </p>
            )}
          </aside>
        </div>
      )}
      {payment && (
        <Payment
          orderId={orderId}
          method={method}
          onConfirm={simulate}
          onResult={finish}
          onClose={() => {
            setPayment(false);
            setError(
              "Payment was dismissed. Your order is saved; continue payment to retry.",
            );
          }}
        />
      )}
    </div>
  );
}
