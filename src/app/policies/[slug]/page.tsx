import Link from "next/link";
const policies = [
  "shipping",
  "cancellations",
  "replacements",
  "privacy",
  "terms",
];
export function generateStaticParams() {
  return policies.map((slug) => ({ slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return { title: `Draft ${(await params).slug} policy` };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <div className="page wrap">
      <article className="article">
        <p className="eyebrow">TRANSPARENCY, ALWAYS</p>
        <h1 style={{ textTransform: "capitalize" }}>{slug} policy</h1>
        <p className="message">
          Draft placeholder — subject to business approval. This demo does not
          establish real commercial terms.
        </p>
        <h2>A demonstration, with care.</h2>
        <p>
          No real purchases, payments, delivery, refunds, or replacements occur
          here. All product information, availability, prices, service areas,
          and estimates are illustrative.
        </p>
        <p>
          The demo saves cart and wishlist identifiers and quantities in your
          browser. Contact details, addresses, and new demo orders remain in tab
          memory and reset on reload. You can clear the saved demo data using
          “Reset demo” in the footer.
        </p>
        <p>
          Before a real launch, the business must supply approved {slug} terms,
          contact information, service rules, and an appropriate privacy policy.
          These placeholders should not be used as legal guidance.
        </p>
        <nav className="modal-buttons">
          {policies.map((p) => (
            <Link className="underlined" key={p} href={`/policies/${p}`}>
              {p}
            </Link>
          ))}
        </nav>
      </article>
    </div>
  );
}
