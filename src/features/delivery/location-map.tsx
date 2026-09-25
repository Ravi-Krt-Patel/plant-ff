"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import MapCanvas from "./map-canvas";
import "./delivery-map.css";

export type Coordinates = { latitude: number; longitude: number };

export function validCoordinates(
  value: Coordinates | null | undefined,
): value is Coordinates {
  return Boolean(
    value &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude) &&
    Math.abs(value.latitude) <= 90 &&
    Math.abs(value.longitude) <= 180,
  );
}

export type LocationMapProps = {
  destination: Coordinates | null;
  rider?: Coordinates | null;
  riderLabel?: string;
  destinationLabel?: string;
  editable?: boolean;
  onChange?: (value: Coordinates) => void;
};

export function LocationMap({
  destination,
  rider = null,
  destinationLabel = "Delivery destination",
  riderLabel = "Latest delivery location",
  editable = false,
  onChange,
}: LocationMapProps) {
  const [loaded, setLoaded] = useState(false);
  const selectedDestination = validCoordinates(destination)
    ? destination
    : null;
  const selectedRider = validCoordinates(rider) ? rider : null;

  return (
    <div className="delivery-map">
      {!loaded ? (
        <div className="delivery-map-preview">
          <MapPin size={30} aria-hidden="true" />
          <strong>
            {editable ? "Choose your delivery pin" : "Your delivery on the map"}
          </strong>
          <p>
            {editable
              ? "Open the map, then tap your entrance or drag the pin to the right place."
              : "View the destination and any available delivery location."}
          </p>
          <button
            className="delivery-map-button"
            type="button"
            onClick={() => setLoaded(true)}
          >
            Load map
          </button>
          <small>
            Map tiles load from an external map provider. Your device location
            is only requested when you choose it.
          </small>
        </div>
      ) : (
        <MapCanvas
          destination={selectedDestination}
          rider={selectedRider}
          destinationLabel={destinationLabel}
          riderLabel={riderLabel}
          editable={editable}
          onChange={onChange}
        />
      )}
      <div className="delivery-map-legend">
        <p>
          <span className="delivery-map-key" aria-hidden="true" />
          {destinationLabel}:{" "}
          {selectedDestination
            ? `${selectedDestination.latitude.toFixed(6)}, ${selectedDestination.longitude.toFixed(6)}`
            : editable
              ? "No pin selected"
              : "Coordinates not recorded"}
        </p>
        {selectedRider && (
          <p>
            <span
              className="delivery-map-key delivery-map-key-rider"
              aria-hidden="true"
            />
            {riderLabel}: {selectedRider.latitude.toFixed(6)},{" "}
            {selectedRider.longitude.toFixed(6)}
          </p>
        )}
      </div>
    </div>
  );
}
