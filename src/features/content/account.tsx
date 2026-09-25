"use client";
import Link from "next/link";
import { apiEnabled } from "@/features/delivery/api";
import { AddressBook } from "@/features/delivery/address-book";
import { SessionPanel } from "@/features/delivery/session-panel";
import { useStore } from "@/features/cart/store";
import { UserRound, MapPin } from "lucide-react";
export function Account({ addresses = false }: { addresses?: boolean }) {
  const store = useStore();
  if (addresses)
    return (
      <div className="page wrap">
        <p className="eyebrow">YOUR OWN LITTLE GREEN CORNER</p>
        <h1 className="page-title">Your doorsteps.</h1>
        <AddressBook />
      </div>
    );
  if (apiEnabled)
    return (
      <div className="page wrap">
        <h1 className="page-title">Your account.</h1>
        <SessionPanel />
        <div className="account-links">
          <Link href="/account/addresses">Your addresses →</Link>
          <Link href="/account/orders">Your orders →</Link>
          <Link href="/track-order">Track an order →</Link>
        </div>
      </div>
    );
  return (
    <div className="page wrap">
      <p className="eyebrow">YOUR OWN LITTLE GREEN CORNER</p>
      <h1 className="page-title">
        {addresses
          ? "Your doorsteps."
          : store.signedIn
            ? "Welcome back, plant lover."
            : "Make yourself at home."}
      </h1>
      <p className="page-intro">
        Demo account only. No real sign-in, OTP, or authentication. Your
        personal details stay in memory and reset on reload.
      </p>
      {!store.signedIn ? (
        <div className="panel" style={{ maxWidth: 550 }}>
          <UserRound size={35} />
          <h2 style={{ marginTop: 20 }}>A simpler kind of sign-in.</h2>
          <p>
            Try the account experience with a fictional customer. There’s no
            password to remember.
          </p>
          <button
            className="button"
            style={{ marginTop: 25 }}
            onClick={() => store.setSignedIn(true)}
          >
            Continue as demo customer →
          </button>
        </div>
      ) : addresses ? (
        <>
          <button
            className="button"
            onClick={() =>
              store.setAddresses((s) => [
                ...s,
                {
                  name: "Demo Plant Lover",
                  line: `${s.length + 12} Sample Garden Lane`,
                  locality: "Demo locality, Varanasi",
                  landmark: "Fictional garden",
                  pin: "221001",
                  phone: "9000000000",
                  instructions: "",
                },
              ])
            }
          >
            Add fictional sample address
          </button>
          {!store.addresses.length && (
            <p className="message">
              No saved demo addresses yet. Add a sample doorstep to try it.
            </p>
          )}
          {store.addresses.map((a, i) => (
            <div className="panel" style={{ marginTop: 20 }} key={i}>
              <MapPin />
              <h3>{a.name}</h3>
              <p>
                {a.line}, {a.locality}, {a.pin}
              </p>
              <button
                className="text-button"
                onClick={() =>
                  store.setAddresses((s) => s.filter((_, n) => n !== i))
                }
              >
                Remove address
              </button>
            </div>
          ))}
        </>
      ) : (
        <>
          <div className="account-links">
            <Link href="/account/orders">Your orders →</Link>
            <Link href="/account/addresses">Your addresses →</Link>
            <Link href="/wishlist">Your favourites →</Link>
          </div>
          <button
            className="button secondary"
            onClick={() => {
              store.setSignedIn(false);
              store.setAddresses([]);
              store.setOrders([]);
            }}
          >
            Sign out of demo
          </button>
        </>
      )}
    </div>
  );
}
