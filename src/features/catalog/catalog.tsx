"use client";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { SlidersHorizontal, X, Search } from "lucide-react";
import type { Product } from "@/contracts";
import { categories } from "@/mocks/catalog";
import { ProductCard } from "./card";
export function Catalog({
  products,
  category,
  search = false,
}: {
  products: Product[];
  category?: string;
  search?: boolean;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const q = params.get("q") ?? "";
  const cat = category ?? params.get("category") ?? "";
  const care = params.get("care") ?? "";
  const max = Number(params.get("max") || 2000);
  const light = params.get("light") ?? "";
  const stock = params.get("stock") ?? "";
  const sort = params.get("sort") ?? "featured";
  const filtered = products.filter(
    (p) =>
      (!cat || p.category === cat) &&
      (!q || p.name.toLowerCase().includes(q.toLowerCase())) &&
      (!care || p.care === "Easy care") &&
      p.price <= max * 100 &&
      (!light || p.light === light) &&
      (!stock || p.stock > 0),
  );
  if (sort === "price-low") filtered.sort((a, b) => a.price - b.price);
  if (sort === "price-high") filtered.sort((a, b) => b.price - a.price);
  if (sort === "name") filtered.sort((a, b) => a.name.localeCompare(b.name));
  const pages = Math.max(1, Math.ceil(filtered.length / 9));
  const page = Math.min(pages, Math.max(1, Number(params.get("page")) || 1));
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    router.push(`${path}?${next}`, { scroll: false });
  };
  return (
    <div className="page wrap">
      <div className="breadcrumb">
        <Link href="/">Home</Link> /{" "}
        {search ? "Search" : "The green collection"}
      </div>
      <p className="eyebrow">A LITTLE SOMETHING FOR EVERY SPACE</p>
      <h1 className="page-title">
        {search
          ? `Your search${q ? `: “${q}”` : ""}`
          : category === "bundles"
            ? "Better, together."
            : (categories.find((c) => c.slug === cat)?.name ??
              "Find your kind of green.")}
      </h1>
      <p className="page-intro">
        From your first little plant to your favourite leafy corner. Explore our
        sample collection and make yourself at home.
      </p>
      <div className="catalog-layout">
        <aside
          aria-label="Product filters"
          className={`filter-panel ${open ? "open" : ""}`}
        >
          <button
            className="filters-close icon-button"
            aria-label="Close filters"
            onClick={() => setOpen(false)}
          >
            <X size={18} />
          </button>
          <h3>Find your perfect plant</h3>
          {!category && (
            <label>
              Category
              <select
                value={cat}
                onChange={(e) => update("category", e.target.value)}
              >
                <option value="">All greens & essentials</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
                <option value="bundles">Bundles</option>
              </select>
            </label>
          )}
          <label>
            Maximum price · ₹{max}
            <input
              type="range"
              min="200"
              max="2000"
              step="100"
              value={max}
              onChange={(e) => update("max", e.target.value)}
            />
          </label>
          <label>
            Care level
            <select
              value={care}
              onChange={(e) => update("care", e.target.value)}
            >
              <option value="">All care levels</option>
              <option value="easy">Easy care</option>
            </select>
          </label>
          <label>
            Light needs
            <select
              value={light}
              onChange={(e) => update("light", e.target.value)}
            >
              <option value="">Any light</option>
              <option>Bright indirect</option>
              <option>Filtered light</option>
            </select>
          </label>
          <label>
            Availability
            <select
              value={stock}
              onChange={(e) => update("stock", e.target.value)}
            >
              <option value="">All products</option>
              <option value="available">In stock</option>
            </select>
          </label>
          <button
            className="underlined text-button"
            onClick={() => router.push(path)}
          >
            Clear all filters
          </button>
        </aside>
        <div>
          <div className="catalog-toolbar">
            <button className="filter-button" onClick={() => setOpen(true)}>
              <SlidersHorizontal size={15} /> Filters
            </button>
            <span>{filtered.length} little reasons to smile</span>
            <label>
              Sort:{" "}
              <select
                aria-label="Sort products"
                value={sort}
                onChange={(e) => update("sort", e.target.value)}
              >
                <option value="featured">Featured</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
                <option value="name">Name: A to Z</option>
              </select>
            </label>
          </div>
          {filtered.length ? (
            <div className="product-grid">
              {filtered.slice((page - 1) * 9, page * 9).map((p) => (
                <ProductCard product={p} key={p.id} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Search style={{ margin: "auto" }} />
              <h2>No greens found just yet.</h2>
              <p>Try another search or clear your filters.</p>
              <Link className="button" href="/shop">
                Explore all plants
              </Link>
            </div>
          )}
          <nav className="pagination" aria-label="Catalog pages">
            {Array.from({ length: pages }, (_, i) => (
              <Link
                key={i}
                className={page === i + 1 ? "current" : ""}
                href={`${path}?${new URLSearchParams({ ...Object.fromEntries(params), page: String(i + 1) })}`}
                aria-current={page === i + 1 ? "page" : undefined}
              >
                {i + 1}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
