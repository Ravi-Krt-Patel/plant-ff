import type { Repository } from "../repositories/memory";
import { catalogQuerySchema } from "../contracts";
import { requireValue } from "../errors";
import { page } from "./shared";
export class CatalogService {
  constructor(private repository: Repository) {}
  async list(input: unknown) {
    const q = catalogQuerySchema.parse(input);
    return this.repository.read((s) => {
      let products = [...s.products.values()].filter(
        (p) =>
          (!q.q ||
            `${p.name} ${p.category}`
              .toLowerCase()
              .includes(q.q.toLowerCase())) &&
          (!q.category || p.category === q.category) &&
          (!q.light || p.light === q.light) &&
          (!q.care || p.care === q.care) &&
          (!q.size || p.size === q.size) &&
          (!q.planter || p.variants.some((v) => v.id === q.planter)) &&
          (q.minPrice === undefined || p.pricePaise >= q.minPrice) &&
          (q.maxPrice === undefined || p.pricePaise <= q.maxPrice) &&
          (!q.availability ||
            (q.availability === "in_stock" ? p.stock > 0 : p.stock === 0)),
      );
      if (q.sort === "price-low")
        products = products.sort((a, b) => a.pricePaise - b.pricePaise);
      if (q.sort === "price-high")
        products = products.sort((a, b) => b.pricePaise - a.pricePaise);
      if (q.sort === "name")
        products = products.sort((a, b) => a.name.localeCompare(b.name));
      return page(products, q.page, q.limit);
    });
  }
  async get(slug: string) {
    return this.repository.read((s) =>
      requireValue(
        [...s.products.values()].find((p) => p.slug === slug || p.id === slug),
        "Product not found",
      ),
    );
  }
}
