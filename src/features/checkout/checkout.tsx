"use client";
import { apiEnabled } from "@/features/delivery/api";
import { DemoCheckout } from "./demo-checkout";
import { ApiCheckout } from "./api-checkout";
export function Checkout() {
  return apiEnabled ? <ApiCheckout /> : <DemoCheckout />;
}
