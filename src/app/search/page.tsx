import { Suspense } from "react";
import { Catalog } from "@/features/catalog/catalog";
import { products } from "@/mocks/catalog";
export const metadata = { title: "Search your kind of green" };
export default function Page() {
  return (
    <Suspense>
      <Catalog products={products} search />
    </Suspense>
  );
}
