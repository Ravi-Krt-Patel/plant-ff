"use client";
import { useState } from "react";
import Link from "next/link";
import { SlidersHorizontal, Search } from "lucide-react";
import type { Product } from "@/contracts";
import { categories } from "@/mocks/catalog";
import { ProductCard } from "./card";
import { CatalogFilters } from "./catalog-filters";
import { useCatalog } from "./use-catalog";
export function Catalog({
  products,
  category,
  search = false,
}: {
  products: Product[];
  category?: string;
  search?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { query, items, total, pages, page, update, clear, pageHref } =
    useCatalog(products, category);
  const { q, category: cat, sort } = query;
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
        <CatalogFilters
          query={query}
          category={category}
          open={open}
          onClose={() => setOpen(false)}
          onClear={clear}
          update={update}
        />
        <div>
          <div className="catalog-toolbar">
            <button className="filter-button" onClick={() => setOpen(true)}>
              <SlidersHorizontal size={15} /> Filters
            </button>
            <span>{total} little reasons to smile</span>
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
          {total ? (
            <div className="product-grid">
              {items.map((p) => (
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
                href={pageHref(i + 1)}
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
