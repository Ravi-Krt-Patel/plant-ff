import Link from "next/link";
import { notFound } from "next/navigation";
import { products, getProduct } from "@/mocks/catalog";
import { ProductDetail } from "@/features/catalog/detail";
import { ProductCard, SectionHeading } from "@/features/catalog/card";
export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const p = getProduct((await params).slug);
  return { title: p?.name ?? "Plant not found", description: p?.description };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const p = getProduct((await params).slug);
  if (!p) notFound();
  return (
    <div className="page wrap">
      <div className="breadcrumb">
        <Link href="/">Home</Link> / <Link href="/shop">Shop</Link> / {p.name}
      </div>
      <ProductDetail product={p} />
      <section className="section">
        <SectionHeading
          eyebrow="A LITTLE MORE TO LOVE"
          title="Good company for your new green."
        />
        <div className="product-grid">
          {products
            .filter((x) => x.id !== p.id)
            .slice(0, 4)
            .map((p) => (
              <ProductCard product={p} key={p.id} />
            ))}
        </div>
      </section>
    </div>
  );
}
