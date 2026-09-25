import Link from "next/link";
import Image from "next/image";
export const metadata = { title: "Rooted in Kashi" };
export default function Page() {
  return (
    <div className="page wrap">
      <article className="article">
        <p className="eyebrow">A SLOWER MOMENT. A GREENER EVERYDAY.</p>
        <h1>
          Rooted in Kashi.
          <br />
          Growing with you.
        </h1>
        <div className="article-image">
          <Image
            src="/images/lifestyle.jpg"
            alt="Light falling on green leaves"
            fill
            sizes="(max-width:700px) 100vw, 760px"
            priority
          />
        </div>
        <p>
          There’s something lovely about making room for a living thing. A leaf
          unfolding. A sunny windowsill. A small daily ritual that brings you
          back to the present.
        </p>
        <p>
          Kashi Greens is a concept for a neighbourhood plant store inspired by
          Varanasi. This demonstration brings plants, thoughtful planters, and
          approachable care into one calm little corner of the internet.
        </p>
        <h2>A concept, honestly presented.</h2>
        <p>
          Kashi Greens is a replaceable demo brand, not a claim that a business
          or store exists. Products, stock, prices, service areas, and orders
          are sample data. We haven’t invented customer reviews or a physical
          store address.
        </p>
        <Link className="button" href="/shop">
          Find your little green →
        </Link>
      </article>
    </div>
  );
}
