"use client";
import { Heart, Plus, Check, ArrowRight, MapPin } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/features/cart/store";
import { isServiceable } from "@/mocks/services";
export function ProductActions({ id, stock }: { id: string; stock: number }) {
  const { wishlist, toggleWish, dispatch, setNotice } = useStore();
  const [added, setAdded] = useState(false);
  return (
    <>
      <button
        className={`wish-button ${wishlist.includes(id) ? "saved" : ""}`}
        aria-label={
          wishlist.includes(id) ? "Remove from wishlist" : "Save to wishlist"
        }
        onClick={() => toggleWish(id)}
      >
        <Heart
          size={18}
          fill={wishlist.includes(id) ? "currentColor" : "none"}
        />
      </button>
      <button
        className="quick-add"
        disabled={!stock}
        aria-label="Add to bag"
        onClick={() => {
          dispatch({ type: "add", id, variant: "nursery" });
          setNotice("A little green added to your bag");
          setAdded(true);
          setTimeout(() => setAdded(false), 1600);
        }}
      >
        {added ? <Check size={18} /> : <Plus size={18} />}
      </button>
    </>
  );
}
export function DeliveryChecker() {
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState("");
  return (
    <div className="delivery-checker">
      <div className="delivery-title">
        <MapPin size={21} />
        <div>
          <strong>A little green, closer to home.</strong>
          <span>Check your PIN for demo delivery in Varanasi.</span>
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setMessage(
            !/^\d{6}$/.test(pin)
              ? "Please enter a valid six-digit PIN."
              : isServiceable(pin)
                ? "Demo zone available · ₹49 delivery · choose a slot at checkout."
                : "This PIN is outside our configured demo zones. Try 221001.",
          );
        }}
      >
        <input
          aria-label="Delivery PIN code"
          inputMode="numeric"
          maxLength={6}
          placeholder="Enter your PIN code"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
        />
        <button type="submit">
          Check <ArrowRight size={16} />
        </button>
      </form>
      {message && (
        <p className="delivery-result" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
export function ShopTabs() {
  return (
    <div className="shop-tabs">
      <Link className="selected" href="/shop">
        Green favourites
      </Link>
      <Link href="/shop?care=easy">Easy-care picks</Link>
      <Link href="/collections/bundles">Perfect pairs</Link>
    </div>
  );
}
