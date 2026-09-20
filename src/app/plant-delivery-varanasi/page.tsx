import { DeliveryChecker } from "@/features/catalog/actions";
export const metadata = { title: "Demo delivery in Varanasi" };
export default function Page() {
  return (
    <div className="page wrap">
      <div className="article">
        <p className="eyebrow">A LITTLE CLOSER TO HOME</p>
        <h1>
          Made for Varanasi.
          <br />
          One green corner at a time.
        </h1>
        <p>
          This page demonstrates a local delivery experience. The listed zones
          and charges are fictional configuration, not a verified service area
          or a promise of delivery.
        </p>
        <DeliveryChecker />
        <h2>The demo delivery details</h2>
        <p>
          Sample eligible PIN codes: 221001, 221005, and 221010. A six-digit PIN
          alone does not prove serviceability. Other PIN codes, including other
          221-prefixed codes, are not accepted by this demonstration.
        </p>
        <p>
          Illustrative delivery charge: ₹49. Choose a sample morning or evening
          slot at checkout. Cash on delivery is unavailable for demo PIN 221010.
        </p>
        <p>
          Actual areas, charges, slots, cutoffs, and care or replacement
          policies will be provided by the business and validated by a separate
          backend before launch.
        </p>
      </div>
    </div>
  );
}
