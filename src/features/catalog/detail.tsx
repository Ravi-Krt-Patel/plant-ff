"use client";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useState } from "react";
import {
  Heart,
  ShoppingBag,
  Expand,
  Sun,
  Droplets,
  Leaf,
  Package,
} from "lucide-react";
import type { Product, CartLine } from "@/contracts";
import { money, variantPrice } from "@/mocks/catalog";
import { useStore } from "@/features/cart/store";
import { DeliveryChecker } from "./actions";
const Zoom = dynamic(() => import("./zoom"), {
  loading: () => (
    <div role="status" className="message">
      Opening image…
    </div>
  ),
});
export function ProductDetail({ product: p }: { product: Product }) {
  const [variant, setVariant] = useState<CartLine["variant"]>("nursery");
  const [zoom, setZoom] = useState(false);
  const { dispatch, setNotice, wishlist, toggleWish } = useStore();
  return (
    <>
      <div className="detail-grid">
        <div className="detail-image">
          <Image
            src={p.image}
            alt={p.name + " — illustrative photograph"}
            fill
            priority
            sizes="(max-width:700px) 100vw, 50vw"
          />
          <button
            onClick={() => setZoom(true)}
            aria-label="Enlarge product image"
          >
            <Expand size={19} />
          </button>
        </div>
        <div className="detail-copy">
          <p className="eyebrow">{p.tag} · SAMPLE COLLECTION</p>
          <h1>{p.name}</h1>
          <div className="price">{money(variantPrice(p, variant))}</div>
          <p>{p.description}</p>
          <div className="variant-label">Make it yours · Choose a planter</div>
          <div className="variant-options">
            <button
              className={variant === "nursery" ? "selected" : ""}
              aria-pressed={variant === "nursery"}
              onClick={() => setVariant("nursery")}
            >
              Nursery pot · included
            </button>
            <button
              className={variant === "ceramic" ? "selected" : ""}
              aria-pressed={variant === "ceramic"}
              onClick={() => setVariant("ceramic")}
            >
              Ceramic pot · +₹200
            </button>
          </div>
          <div className="detail-buy">
            <button
              className="button"
              disabled={!p.stock}
              onClick={() => {
                dispatch({ type: "add", id: p.id, variant });
                setNotice(`${p.name} added to your bag`);
              }}
            >
              <ShoppingBag size={17} />
              {p.stock ? "Add to your bag" : "Currently sold out"}
            </button>
            <button
              className="icon-button"
              aria-label="Save product to wishlist"
              onClick={() => toggleWish(p.id)}
            >
              <Heart fill={wishlist.includes(p.id) ? "currentColor" : "none"} />
            </button>
          </div>
          {p.stock > 0 && p.stock < 5 && (
            <p>Sample stock: {p.stock} available.</p>
          )}
          <div className="detail-facts">
            <span>
              <Sun size={17} />
              {p.light}
            </span>
            <span>
              <Leaf size={17} />
              {p.care}
            </span>
            <span>
              <Package size={17} />
              Pot included
            </span>
            <span>
              <Droplets size={17} />
              Check mix before watering
            </span>
          </div>
          <details>
            <summary>A little more about your green</summary>
            <p>
              Illustrative sample size: 25–45 cm tall including a 12 cm nursery
              pot. Ceramic option has a matching 14 cm outer pot. SKU: {p.id}-
              {variant}. Natural plants vary in colour, shape, and fullness.
            </p>
          </details>
          <details>
            <summary>Care that feels simple</summary>
            <p>
              Place according to the light guidance. Check the growing mix
              before watering and allow excess water to drain. Follow the
              variety-specific instructions supplied with the plant. No
              pet-safety claims are made.
            </p>
          </details>
        </div>
      </div>
      <div className="delivery-section">
        <DeliveryChecker />
      </div>
      {zoom && (
        <Zoom src={p.image} name={p.name} onClose={() => setZoom(false)} />
      )}
    </>
  );
}
