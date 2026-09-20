import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Catalog } from "@/features/catalog/catalog";
import { products, categories } from "@/mocks/catalog";
export function generateStaticParams() {
  return [...categories.map((c) => ({ slug: c.slug })), { slug: "bundles" }];
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return { title: (await params).slug.replaceAll("-", " ") };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!categories.some((c) => c.slug === slug) && slug !== "bundles")
    notFound();
  return (
    <Suspense>
      <Catalog
        products={products.filter((p) => p.category === slug)}
        category={slug}
      />
    </Suspense>
  );
}
