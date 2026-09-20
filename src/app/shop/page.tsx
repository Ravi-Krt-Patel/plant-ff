import { Suspense } from "react";
import { Catalog } from "@/features/catalog/catalog";
import { products } from "@/mocks/catalog";
export const metadata = { title: "Shop plants & essentials" };
export default function Page() {
  return (
    <Suspense
      fallback={<div className="loading">Growing your collection…</div>}
    >
      <Catalog products={products} />
    </Suspense>
  );
}
