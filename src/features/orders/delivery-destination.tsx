"use client";

import { LocationMap } from "@/features/delivery/location-map";
import type { LegacyDeliveryAddress } from "@/features/delivery/contracts";

export function DeliveryDestination({
  address,
}: {
  address?: LegacyDeliveryAddress | null;
}) {
  return (
    <div className="delivery-destination">
      <h2>Delivery address</h2>
      {address ? (
        <address
          style={{
            fontStyle: "normal",
            lineHeight: 1.8,
            overflowWrap: "anywhere",
          }}
        >
          <strong>{address.name}</strong>
          <br />
          {address.line}
          <br />
          {[address.locality, address.city, address.state, address.pin]
            .filter(Boolean)
            .join(", ")}
          {address.landmark && (
            <>
              <br />
              Landmark: {address.landmark}
            </>
          )}
          <br />
          {address.phone}
          {address.instructions && <p>Delivery note: {address.instructions}</p>}
        </address>
      ) : (
        <p>A delivery address is not available for this older order.</p>
      )}
    </div>
  );
}

export function coordinates(
  address?: { latitude?: number | null; longitude?: number | null } | null,
) {
  if (
    typeof address?.latitude !== "number" ||
    !Number.isFinite(address.latitude) ||
    typeof address.longitude !== "number" ||
    !Number.isFinite(address.longitude) ||
    Math.abs(address.latitude) > 90 ||
    Math.abs(address.longitude) > 180
  )
    return null;
  return { latitude: address.latitude, longitude: address.longitude };
}

export function DemoDestination({
  address,
}: {
  address?: LegacyDeliveryAddress;
}) {
  const destination = coordinates(address);
  return (
    <section style={{ marginTop: 28 }}>
      <DeliveryDestination address={address} />
      {destination ? (
        <LocationMap
          destination={destination}
          destinationLabel="Saved delivery pin"
        />
      ) : (
        <p className="message">No delivery pin saved for this order.</p>
      )}
      <p style={{ fontSize: 13 }}>
        No delivery-agent location is available for this demo order.
      </p>
    </section>
  );
}
