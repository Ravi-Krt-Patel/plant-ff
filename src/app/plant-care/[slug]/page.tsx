import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { guides } from "@/mocks/catalog";
export function generateStaticParams() {
  return guides.map((g) => ({ slug: g.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return { title: guides.find((g) => g.slug === slug)?.title };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const g = guides.find((g) => g.slug === slug);
  if (!g) notFound();
  return (
    <div className="page wrap">
      <article className="article">
        <div className="breadcrumb">
          <Link href="/plant-care">Plant care</Link> / {g.label}
        </div>
        <p className="eyebrow">{g.label}</p>
        <h1>{g.title}</h1>
        <div className="article-image">
          <Image
            src={g.image}
            alt="Green plant in a home"
            fill
            sizes="(max-width:700px) 100vw, 760px"
            priority
          />
        </div>
        <p>{g.text}</p>
        <h2>Make a little time to notice.</h2>
        <p>
          Look at your plant regularly. Changes in leaves or growing mix are a
          reason to check the environment, not to rush into a one-size-fits-all
          remedy. Start with the care information for the exact variety, and ask
          a knowledgeable nursery when you’re unsure.
        </p>
        <p>
          This is general sample editorial content, not a diagnosis or a
          plant-health guarantee.
        </p>
        <Link className="button" href="/shop?care=easy">
          Meet the easy-care crew →
        </Link>
      </article>
    </div>
  );
}
