"use client";
import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import type { Order, Address } from "@/contracts";
import { restoreCart } from "@/mocks/services";
import { getProduct } from "@/mocks/catalog";
import { cartReducer } from "./reducer";
function useStoreValue() {
  const [lines, dispatch] = useReducer(cartReducer, []);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        dispatch({
          type: "load",
          lines: restoreCart(localStorage.getItem("kg-cart")),
        });
        const saved: unknown = JSON.parse(
          localStorage.getItem("kg-wishlist") ?? "[]",
        );
        if (Array.isArray(saved))
          setWishlist(
            saved.filter(
              (id): id is string => typeof id === "string" && !!getProduct(id),
            ),
          );
      } catch {}
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem("kg-cart", JSON.stringify({ version: 1, lines }));
        localStorage.setItem("kg-wishlist", JSON.stringify(wishlist));
      } catch {}
    }
  }, [lines, wishlist, ready]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(t);
  }, [notice]);
  return {
    lines,
    dispatch,
    wishlist,
    toggleWish: (id: string) =>
      setWishlist((s) =>
        s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
      ),
    notice,
    setNotice,
    signedIn,
    setSignedIn,
    addresses,
    setAddresses,
    orders,
    setOrders,
    reset: () => {
      dispatch({ type: "clear" });
      setWishlist([]);
      setOrders([]);
      setAddresses([]);
      setSignedIn(false);
      setNotice("Demo reset");
    },
  };
}
const Store = createContext<ReturnType<typeof useStoreValue> | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const value = useStoreValue();
  return (
    <Store.Provider value={value}>
      {children}
      <div role="status" className={`toast ${value.notice ? "show" : ""}`}>
        {value.notice}
      </div>
    </Store.Provider>
  );
}
export function useStore() {
  const v = useContext(Store);
  if (!v) throw new Error("Missing store provider");
  return v;
}
