"use client";
import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, Heart } from "lucide-react";
import { useState } from "react";
import { useStore } from "./store";
import { getProduct, money, variantPrice, products } from "@/mocks/catalog";
import { quote } from "@/mocks/services";
import { ProductCard } from "@/features/catalog/card";
export function Cart() {
  const { lines, dispatch } = useStore();
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState("");
  const [feedback, setFeedback] = useState("");
  const total = quote(lines, applied);
  return (
    <div className="page wrap">
      <div className="breadcrumb">
        <Link href="/">Home</Link> / Your bag
      </div>
      <h1 className="page-title">A little happiness, bagged.</h1>
      <p className="page-intro">
        Your green corner is coming together beautifully.
      </p>
      {!lines.length ? (
        <div className="empty-state">
          <ShoppingBag style={{ margin: "auto" }} />
          <h2>Your bag is waiting to grow.</h2>
          <p>Let’s find a little green you’ll love.</p>
          <Link className="button" href="/shop">
            Explore the collection
          </Link>
        </div>
      ) : (
        <div className="two-columns">
          <div>
            {lines.map((l) => {
              const p = getProduct(l.id);
              if (!p) return null;
              return (
                <div className="cart-row" key={l.id + l.variant}>
                  <Link href={`/products/${p.slug}`}>
                    <Image src={p.image} width={95} height={115} alt={p.name} />
                  </Link>
                  <div>
                    <Link href={`/products/${p.slug}`}>
                      <h3>{p.name}</h3>
                    </Link>
                    <small>
                      {l.variant === "ceramic"
                        ? "Ceramic planter"
                        : "Nursery pot"}{" "}
                      · {money(variantPrice(p, l.variant))}
                    </small>
                    <div className="quantity">
                      <button
                        aria-label={`Decrease ${p.name}`}
                        onClick={() =>
                          dispatch({
                            type: "quantity",
                            id: l.id,
                            variant: l.variant,
                            quantity: l.quantity - 1,
                          })
                        }
                      >
                        −
                      </button>
                      <span aria-live="polite">{l.quantity}</span>
                      <button
                        aria-label={`Increase ${p.name}`}
                        disabled={l.quantity >= p.stock || l.quantity >= 10}
                        onClick={() =>
                          dispatch({
                            type: "quantity",
                            id: l.id,
                            variant: l.variant,
                            quantity: l.quantity + 1,
                          })
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div>
                    <strong>
                      {money(variantPrice(p, l.variant) * l.quantity)}
                    </strong>
                    <br />
                    <button
                      className="remove-button"
                      onClick={() =>
                        dispatch({
                          type: "quantity",
                          id: l.id,
                          variant: l.variant,
                          quantity: 0,
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
            <Link className="text-link" href="/shop">
              ← Keep exploring
            </Link>
          </div>
          <aside className="panel summary-panel">
            <h2>Your little collection</h2>
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
                <span>GROW10 savings</span>
                <span>−{money(total.discount)}</span>
              </div>
            )}
            <div className="summary-row total">
              <strong>Total</strong>
              <strong>{money(total.total)}</strong>
            </div>
            <form
              className="coupon"
              onSubmit={(e) => {
                e.preventDefault();
                if (coupon.toUpperCase() === "GROW10") {
                  setApplied(coupon);
                  setFeedback("A little gift: 10% demo discount applied.");
                } else {
                  setApplied("");
                  setFeedback("This demo code is not valid. Try GROW10.");
                }
              }}
            >
              <input
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
                placeholder="Have a little gift code?"
                aria-label="Coupon code"
              />
              <button>Apply</button>
            </form>
            <p role="status" className="message">
              {feedback ||
                "Try GROW10 for a sample 10% discount. Reapply it at checkout."}
            </p>
            <Link className="button full-width" href="/checkout">
              Continue to checkout →
            </Link>
            <p style={{ fontSize: 11, marginTop: 12, color: "#6c775f" }}>
              Simulated checkout. No real payment or delivery.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
export function Wishlist() {
  const { wishlist } = useStore();
  return (
    <div className="page wrap">
      <p className="eyebrow">SAVED FOR A GREENER DAY</p>
      <h1 className="page-title">The ones you love.</h1>
      <p className="page-intro">
        A little collection of things that caught your eye.
      </p>
      {wishlist.length ? (
        <div className="product-grid">
          {products
            .filter((p) => wishlist.includes(p.id))
            .map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
        </div>
      ) : (
        <div className="empty-state">
          <Heart style={{ margin: "auto" }} />
          <h2>Your wishlist has room to grow.</h2>
          <p>Tap a heart to keep your favourites close.</p>
          <Link className="button" href="/shop">
            Find a favourite
          </Link>
        </div>
      )}
    </div>
  );
}
