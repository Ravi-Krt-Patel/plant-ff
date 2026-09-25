import { describe, expect, it } from "vitest";
import { products } from "@/mocks/catalog";
import {
  readCatalogQuery,
  selectCatalog,
  updateCatalogQuery,
} from "@/features/catalog/query";

const query = (search = "", category?: string) =>
  readCatalogQuery(new URLSearchParams(search), category);

describe("catalog selection", () => {
  it("keeps the featured order and paginates nine products at a time", () => {
    const result = selectCatalog(products, query());
    expect(result).toEqual({
      items: products.slice(0, 9),
      total: 24,
      pages: 3,
      page: 1,
    });
    expect(selectCatalog(products, query("page=2")).items).toEqual(
      products.slice(9, 18),
    );
    expect(selectCatalog(products, query("page=999")).items).toEqual(
      products.slice(18),
    );
  });
  it("combines search, category, price, care, light, and stock filters", () => {
    const fixture = { ...products[0]!, care: "Easy care" };
    const variants = [
      fixture,
      { ...fixture, id: "wrong-name", name: "Unrelated" },
      { ...fixture, id: "wrong-category", category: "other" },
      { ...fixture, id: "too-expensive", price: 999999 },
      { ...fixture, id: "wrong-care", care: "Advanced" },
      { ...fixture, id: "wrong-light", light: "Darkness" },
      { ...fixture, id: "sold-out", stock: 0 },
    ];
    const params = new URLSearchParams({
      q: fixture.name.toUpperCase(),
      category: fixture.category,
      max: "2000",
      care: "easy",
      light: fixture.light,
      stock: "available",
    });
    expect(selectCatalog(variants, readCatalogQuery(params)).items).toEqual([
      fixture,
    ]);
  });
  it("lets the collection route override a conflicting category query", () => {
    const result = selectCatalog(
      products,
      query("category=other", products[0]!.category),
    );
    expect(result.total).toBeGreaterThan(0);
    expect(
      result.items.every((p) => p.category === products[0]!.category),
    ).toBe(true);
  });
  it.each(["price-low", "price-high", "name"])(
    "sorts %s without mutating the input",
    (sort) => {
      const original = [...products];
      const compare =
        sort === "name"
          ? (a: (typeof products)[number], b: (typeof products)[number]) =>
              a.name.localeCompare(b.name)
          : (a: (typeof products)[number], b: (typeof products)[number]) =>
              sort === "price-low" ? a.price - b.price : b.price - a.price;
      expect(selectCatalog(products, query("sort=" + sort)).items).toEqual(
        [...products].sort(compare).slice(0, 9),
      );
      expect(products).toEqual(original);
    },
  );
  it("keeps a single empty page for no matches", () => {
    expect(selectCatalog(products, query("q=does-not-exist&page=9"))).toEqual({
      items: [],
      total: 0,
      pages: 1,
      page: 1,
    });
  });
  it.each(["page=-1", "page=garbage", "page=0"])(
    "falls back to page one for %s",
    (search) => {
      expect(selectCatalog(products, query(search)).page).toBe(1);
    },
  );
  it("resets pagination on filter changes and preserves unrelated parameters", () => {
    const result = new URLSearchParams(
      updateCatalogQuery("page=3&q=plant&utm_source=mail", "care", "easy"),
    );
    expect(Object.fromEntries(result)).toEqual({
      q: "plant",
      utm_source: "mail",
      care: "easy",
    });
  });
  it("removes cleared filters and retains filters on page changes", () => {
    expect(updateCatalogQuery("care=easy&page=2", "care", "")).toBe("");
    expect(updateCatalogQuery("care=easy", "page", "2")).toBe(
      "care=easy&page=2",
    );
  });
});
