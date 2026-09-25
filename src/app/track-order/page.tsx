import { Suspense } from "react";
import { TrackingLookup } from "@/features/orders/views";
export const metadata = { title: "Track your order" };
export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="page wrap" role="status">
          Preparing order tracking…
        </div>
      }
    >
      <TrackingLookup />
    </Suspense>
  );
}
