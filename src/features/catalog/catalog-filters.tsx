"use client";
import { X } from "lucide-react";
import { categories } from "@/mocks/catalog";
import type { CatalogQuery, CatalogQueryKey } from "./query";

type CatalogFiltersProps = {
  query: CatalogQuery;
  category?: string;
  open: boolean;
  onClose: () => void;
  onClear: () => void;
  update: (key: CatalogQueryKey, value: string) => void;
};

export function CatalogFilters({
  query,
  category,
  open,
  onClose,
  onClear,
  update,
}: CatalogFiltersProps) {
  const { category: cat, max, care, light, stock } = query;
  return (
    <aside
      aria-label="Product filters"
      className={`filter-panel ${open ? "open" : ""}`}
    >
      <button
        className="filters-close icon-button"
        aria-label="Close filters"
        onClick={onClose}
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
        <select value={care} onChange={(e) => update("care", e.target.value)}>
          <option value="">All care levels</option>
          <option value="easy">Easy care</option>
        </select>
      </label>
      <label>
        Light needs
        <select value={light} onChange={(e) => update("light", e.target.value)}>
          <option value="">Any light</option>
          <option>Bright indirect</option>
          <option>Filtered light</option>
        </select>
      </label>
      <label>
        Availability
        <select value={stock} onChange={(e) => update("stock", e.target.value)}>
          <option value="">All products</option>
          <option value="available">In stock</option>
        </select>
      </label>
      <button className="underlined text-button" onClick={onClear}>
        Clear all filters
      </button>
    </aside>
  );
}
