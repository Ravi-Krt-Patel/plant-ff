"use client";
import { MapPin } from "lucide-react";
export default function Map() {
  return (
    <div
      className="map-placeholder"
      role="img"
      aria-label="Illustrative tracking — simulated location, not a real map"
    >
      <div>
        <MapPin style={{ margin: "0 auto 10px" }} />
        <strong>Somewhere on the green route</strong>
        <p>
          Illustrative tracking — simulated location
          <br />
          No GPS or live rider data.
        </p>
      </div>
    </div>
  );
}
