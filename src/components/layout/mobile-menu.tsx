"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Brand } from "./brand";
import { navigationLinks } from "./navigation";

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 701px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="mobile-menu icon-button" aria-label="Open menu">
          <Menu />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="menu-backdrop" />
        <Dialog.Content className="menu-drawer" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">Explore Kashi Greens</Dialog.Title>
          <div className="menu-drawer-heading">
            <Dialog.Close asChild>
              <Link href="/" aria-label="Kashi Greens home">
                <Brand />
              </Link>
            </Dialog.Close>
            <Dialog.Close
              className="icon-button menu-close"
              aria-label="Close menu"
            >
              <X size={22} />
            </Dialog.Close>
          </div>
          <nav className="drawer-navigation" aria-label="Mobile navigation">
            {[...navigationLinks, ["/about", "Our story"] as const].map(
              ([url, title]) => (
                <Dialog.Close asChild key={url}>
                  <Link
                    href={url}
                    aria-current={pathname === url ? "page" : undefined}
                  >
                    {title}
                    <ArrowUpRight size={17} />
                  </Link>
                </Dialog.Close>
              ),
            )}
          </nav>
          <p className="menu-drawer-note">A little green. A lot of joy.</p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
