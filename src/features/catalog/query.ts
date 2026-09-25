import type { Product } from "@/contracts";

const PAGE_SIZE = 9;
export type CatalogQueryKey =
  "q" | "category" | "care" | "max" | "light" | "stock" | "sort" | "page";
export type CatalogQuery = {
  q: string;
  category: string;
  care: string;
  max: number;
  light: string;
  stock: string;
  sort: string;
  page: number;
};

export function readCatalogQuery(
  params: Pick<URLSearchParams, "get">,
  category?: string,
): CatalogQuery {
  return {
    q: params.get("q") ?? "",
    category: category ?? params.get("category") ?? "",
    care: params.get("care") ?? "",
    max: Number(params.get("max") || 2000),
    light: params.get("light") ?? "",
    stock: params.get("stock") ?? "",
    sort: params.get("sort") ?? "featured",
    page: Math.max(1, Number(params.get("page")) || 1),
  };
}

export function selectCatalog(
  products: readonly Product[],
  query: CatalogQuery,
) {
  const filtered = products.filter(
    (p) =>
      (!query.category || p.category === query.category) &&
      (!query.q || p.name.toLowerCase().includes(query.q.toLowerCase())) &&
      (!query.care || p.care === "Easy care") &&
      p.price <= query.max * 100 &&
      (!query.light || p.light === query.light) &&
      (!query.stock || p.stock > 0),
  );
  if (query.sort === "price-low") filtered.sort((a, b) => a.price - b.price);
  if (query.sort === "price-high") filtered.sort((a, b) => b.price - a.price);
  if (query.sort === "name")
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(pages, query.page);
  return {
    items: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    total: filtered.length,
    pages,
    page,
  };
}

export function updateCatalogQuery(
  search: string,
  key: CatalogQueryKey,
  value: string,
) {
  const next = new URLSearchParams(search);
  if (value) next.set(key, value);
  else next.delete(key);
  if (key !== "page") next.delete("page");
  return next.toString();
}
