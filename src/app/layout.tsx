import { CartTool } from "@/components/cart-tool";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Header, Footer } from "@/components/layout/shell";
import { StoreProvider } from "@/features/cart/store";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Kashi Greens — A little green. A lot of joy.",
    template: "%s | Kashi Greens",
  },
  description:
    "A thoughtfully grown demo plant store for Varanasi. Find plants, pots and a little everyday joy.",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (
    process.env.NEXT_PUBLIC_DATA_SOURCE &&
    process.env.NEXT_PUBLIC_DATA_SOURCE !== "mock"
  )
    throw new Error(
      "Only mock data is supported. A live backend adapter has not been integrated.",
    );
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <StoreProvider>
          <CartTool />
          <Suspense>
            <Header />
          </Suspense>
          <main id="main">{children}</main>
          <Footer />
        </StoreProvider>
      </body>
    </html>
  );
}
