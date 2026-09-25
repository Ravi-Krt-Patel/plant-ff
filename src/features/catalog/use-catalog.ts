"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Product } from "@/contracts";
import {
  readCatalogQuery,
  selectCatalog,
  updateCatalogQuery,
  type CatalogQueryKey,
} from "./query";

export function useCatalog(products: readonly Product[], category?: string) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const query = readCatalogQuery(params, category);
  const href = (key: CatalogQueryKey, value: string) =>
    path + "?" + updateCatalogQuery(params.toString(), key, value);

  return {
    query,
    ...selectCatalog(products, query),
    update: (key: CatalogQueryKey, value: string) =>
      router.push(href(key, value), { scroll: false }),
    clear: () => router.push(path),
    pageHref: (page: number) => href("page", String(page)),
  };
}
