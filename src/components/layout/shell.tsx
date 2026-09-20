"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Search,
  Heart,
  ShoppingBag,
  UserRound,
  Menu,
  X,
  MapPin,
  ArrowUpRight,
} from "lucide-react";
import { useStore } from "@/features/cart/store";
import { Brand } from "./brand";
export function Header() {
  const { lines } = useStore();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return (
    <>
      <div
        className="announcement"
        role="region"
        aria-label="Store announcement"
      >
        <span>Rooted in Kashi. Growing with you.</span>
        <Link href="/plant-delivery-varanasi" className="delivery-link">
          <MapPin size={13} /> Discover demo delivery in Varanasi{" "}
          <ArrowUpRight size={13} />
        </Link>
      </div>
      <header className="header">
        <div className="header-main wrap">
          <Link href="/" aria-label="Kashi Greens home">
            <Brand />
          </Link>
          <form action="/search" className="search">
            <Search size={18} />
            <input
              name="q"
              placeholder="Find your kind of green…"
              aria-label="Search plants and accessories"
            />
            <kbd>↵</kbd>
          </form>
          <div className="header-actions">
            <Link href="/account" aria-label="My account">
              <UserRound />
            </Link>
            <Link href="/wishlist" aria-label="Wishlist">
              <Heart />
            </Link>
            <Link
              className="cart-link"
              href="/cart"
              aria-label={`Shopping bag, ${lines.reduce((n, l) => n + l.quantity, 0)} items`}
            >
              <ShoppingBag />
              <span>{lines.reduce((n, l) => n + l.quantity, 0)}</span>
            </Link>
            <button
              className="mobile-menu icon-button"
              onClick={() => setOpen(!open)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        <nav
          aria-label="Main navigation"
          className={`nav wrap ${open ? "is-open" : ""}`}
        >
          {[
            ["/shop", "Shop all plants"],
            ["/collections/indoor-plants", "Indoor plants"],
            ["/collections/outdoor-plants", "Outdoor plants"],
            ["/collections/pots-planters", "Pots & planters"],
            ["/collections/bundles", "Plant bundles"],
            ["/plant-care", "Plant care"],
          ].map(([url, title]) => (
            <Link
              key={url}
              href={url!}
              className={pathname === url ? "active" : ""}
              onClick={() => setOpen(false)}
            >
              {title}
            </Link>
          ))}
          <Link href="/about" className="nav-story">
            Our story <ArrowUpRight size={14} />
          </Link>
        </nav>
        <form action="/search" className="mobile-search">
          <Search size={17} />
          <input
            name="q"
            placeholder="Search plants & more"
            aria-label="Search on mobile"
          />
        </form>
      </header>
    </>
  );
}
export function Footer() {
  const { reset } = useStore();
  return (
    <>
      <footer>
        <div className="wrap footer-grid">
          <div>
            <Link href="/">
              <Brand />
            </Link>
            <p>
              Rooted in the spirit of Kashi.
              <br />
              Bringing a little more green to your everyday.
            </p>
            <span className="footer-location">
              <MapPin size={16} /> Made for Varanasi
            </span>
          </div>
          <div>
            <h3>Find your green</h3>
            <Link href="/shop">All plants</Link>
            <Link href="/collections/pots-planters">Pots & planters</Link>
            <Link href="/collections/bundles">Plant bundles</Link>
            <Link href="/wishlist">Your wishlist</Link>
          </div>
          <div>
            <h3>Here to help</h3>
            <Link href="/plant-care">Plant care guides</Link>
            <Link href="/track-order">Track demo order</Link>
            <Link href="/faq">FAQs</Link>
            <Link href="/contact">Contact us</Link>
          </div>
          <div>
            <h3>A little transparency</h3>
            <Link href="/about">Our story</Link>
            <Link href="/plant-delivery-varanasi">Delivery information</Link>
            <Link href="/policies/shipping">Draft policies</Link>
            <button className="text-button" onClick={reset}>
              Reset demo
            </button>
          </div>
        </div>
        <div className="wrap footer-bottom">
          <span>
            © 2026 Kashi Greens · A concept store, thoughtfully grown.
          </span>
          <Link href="/policies/privacy">Privacy</Link>
          <Link href="/policies/terms">Terms</Link>
        </div>
      </footer>
      <div
        className="demo-notice"
        role="region"
        aria-label="Demo storefront notice"
      >
        Demo storefront — sample products and simulated orders/payments. Use
        fictitious details.
      </div>
    </>
  );
}
