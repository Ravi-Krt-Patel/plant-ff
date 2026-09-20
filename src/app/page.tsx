import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  Leaf,
  Package,
  Heart,
  Sun,
} from "lucide-react";
import { products, categories, guides } from "@/mocks/catalog";
import { ProductCard, SectionHeading } from "@/features/catalog/card";
import { DeliveryChecker, ShopTabs } from "@/features/catalog/actions";
export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span /> ROOTED IN KASHI. MADE FOR YOUR HOME.
          </p>
          <h1>
            A little green.
            <br />A lot of <em>joy.</em>
          </h1>
          <p className="hero-description">
            For sunny balconies, cosy corners, and everything
            <br className="desktop-break" /> in between. Find a plant that feels
            like you.
          </p>
          <Link className="button" href="/shop">
            Find your green <ArrowUpRight size={18} />
          </Link>
          <div className="hero-note">
            <Leaf size={18} />
            <span>Thoughtfully picked. Ready to make you smile.</span>
          </div>
        </div>
        <div className="hero-photo">
          <Image
            src="/images/hero.jpg"
            alt="A lush green monstera in an ivory pot, bringing life to a quiet home"
            fill
            priority
            sizes="(max-width:700px) 100vw, 52vw"
          />
          <div className="hero-stamp">
            <Leaf size={25} />
            <span>
              GROW A LITTLE
              <br />
              HAPPINESS
            </span>
          </div>
          <Link href="/products/monstera-deliciosa" className="hero-product">
            <div>
              <span>MEET YOUR NEW ROOMMATE</span>
              <strong>Monstera Deliciosa</strong>
            </div>
            <ArrowUpRight size={23} />
          </Link>
          <div className="photo-caption">A greener everyday starts here.</div>
        </div>
      </section>
      <div className="promise-strip wrap">
        <span>
          <Leaf />A plant for every kind of person
        </span>
        <span>
          <Package />
          Thoughtfully packed, with care
        </span>
        <span>
          <Sun />
          Simple tips for happy plants
        </span>
        <span>
          <Heart />A little love for local living
        </span>
      </div>
      <section className="section wrap">
        <SectionHeading
          eyebrow="FIND YOUR LITTLE PATCH OF GREEN"
          title="What’s your green mood?"
          link="Explore everything"
        />
        <div className="category-grid">
          {categories.map((c) => (
            <Link
              className="category"
              key={c.slug}
              href={`/collections/${c.slug}`}
            >
              <div className="category-image">
                <Image
                  src={`/images/${c.image}.jpg`}
                  alt=""
                  fill
                  sizes="(max-width:600px) 30vw, 15vw"
                />
              </div>
              <h3>
                {c.name} <ArrowUpRight size={14} />
              </h3>
            </Link>
          ))}
        </div>
      </section>
      <section className="section featured">
        <div className="wrap">
          <SectionHeading
            eyebrow="GOOD COMPANY, NATURALLY"
            title="Your next favourite roommate."
            link="Shop all plants"
          />
          <ShopTabs />
          <div className="product-grid">
            {products.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>
      <div className="wrap delivery-section">
        <DeliveryChecker />
      </div>
      <section className="story-section wrap">
        <div className="story-image">
          <Image
            src="/images/lifestyle.jpg"
            alt="Sunlight falling on fresh green leaves in a home"
            fill
            sizes="(max-width:700px) 100vw, 45vw"
          />
          <span>SMALL BEGINNINGS. BEAUTIFUL THINGS.</span>
        </div>
        <div className="story-copy">
          <p className="eyebrow">NEW TO PLANT PARENTHOOD?</p>
          <h2>
            You don’t need a green thumb.
            <br />
            <em>Just a little curiosity.</em>
          </h2>
          <p>
            Start small. Find your sunny spot. We’ve picked easy-going greens
            and simple care guides to help you grow, one leaf at a time.
          </p>
          <Link className="button" href="/shop?care=easy">
            Meet the easy-care crew <ArrowUpRight size={17} />
          </Link>
          <Link className="text-link" href="/plant-care">
            A little guidance goes a long way <ArrowRight size={16} />
          </Link>
        </div>
      </section>
      <section className="section wrap">
        <SectionHeading
          eyebrow="ROOTING FOR YOU"
          title="Happy plants start with a little know-how."
          link="All care guides"
          href="/plant-care"
        />
        <div className="guide-grid">
          {guides.map((g) => (
            <Link
              href={`/plant-care/${g.slug}`}
              className="guide-card"
              key={g.slug}
            >
              <div>
                <Image
                  src={g.image}
                  alt="Plant care inspiration"
                  fill
                  sizes="(max-width:700px) 90vw, 30vw"
                />
              </div>
              <p className="eyebrow">{g.label}</p>
              <h3>
                {g.title}
                <ArrowUpRight size={18} />
              </h3>
            </Link>
          ))}
        </div>
      </section>
      <section className="brand-banner">
        <Leaf size={34} />
        <p>
          From the city of timeless stories,
          <br />a fresh little chapter of green.
        </p>
        <Link href="/about">
          Get to know Kashi Greens <ArrowUpRight size={17} />
        </Link>
      </section>
    </>
  );
}
