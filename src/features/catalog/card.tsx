import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { type Product } from "@/contracts";
import { money } from "@/mocks/catalog";
import { ProductActions } from "./actions";
export function ProductCard({ product: p }: { product: Product }) {
  return (
    <article className="product-card">
      <div className="product-image">
        <Link href={`/products/${p.slug}`}>
          <Image
            src={p.image}
            alt={p.name + " — illustrative plant photograph"}
            fill
            sizes="(max-width:600px) 46vw, (max-width:1000px) 30vw, 23vw"
          />
        </Link>
        <span className="product-tag">{!p.stock ? "Sold out" : p.tag}</span>
        <ProductActions id={p.id} stock={p.stock} />
      </div>
      <div className="product-meta">
        <span>
          {p.category.includes("plants")
            ? "A little living joy"
            : p.category === "bundles"
              ? "Better together"
              : "For your green corner"}
        </span>
        <Link href={`/products/${p.slug}`}>
          <h3>{p.name}</h3>
        </Link>
        <div className="product-price">
          <strong>{money(p.price)}</strong>
          <span>{p.care}</span>
        </div>
      </div>
    </article>
  );
}
export function SectionHeading({
  eyebrow,
  title,
  link,
  href = "/shop",
}: {
  eyebrow: string;
  title: string;
  link?: string;
  href?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {link && (
        <Link className="underlined" href={href}>
          {link}
          <ArrowUpRight size={18} />
        </Link>
      )}
    </div>
  );
}
