import Link from "next/link";
import Image from "next/image";
import { guides } from "@/mocks/catalog";
export const metadata = { title: "Plant care, made simple" };
export default function Page() {
  return (
    <div className="page wrap">
      <p className="eyebrow">A LITTLE KNOW-HOW, A LOT OF GROWTH</p>
      <h1 className="page-title">We’re rooting for you.</h1>
      <p className="page-intro">
        Simple starting points for your plant-parent journey. Get curious,
        observe, and grow together.
      </p>
      <div className="guide-grid">
        {guides.map((g) => (
          <Link
            key={g.slug}
            href={`/plant-care/${g.slug}`}
            className="guide-card"
          >
            <div>
              <Image
                src={g.image}
                alt="Plant care inspiration"
                fill
                sizes="(max-width:700px) 100vw, 33vw"
              />
            </div>
            <p className="eyebrow">{g.label}</p>
            <h3>{g.title} ↗</h3>
          </Link>
        ))}
      </div>
    </div>
  );
}
