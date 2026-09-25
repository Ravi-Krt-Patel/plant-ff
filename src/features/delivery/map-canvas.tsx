"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import type { Coordinates, LocationMapProps } from "./location-map";
import "leaflet/dist/leaflet.css";

const tileUrl =
  process.env.NEXT_PUBLIC_MAP_TILE_URL ||
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const attribution =
  process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const varanasi: [number, number] = [25.3176, 82.9739];
type Runtime = { leaflet: typeof import("leaflet"); map: LeafletMap };
type MapState = "loading" | "ready" | "tile-error" | "unavailable" | "offline";

export default function MapCanvas({
  destination,
  rider = null,
  destinationLabel = "Delivery destination",
  riderLabel = "Latest delivery location",
  editable = false,
  onChange,
}: LocationMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [state, setState] = useState<MapState>("loading");
  const [attempt, setAttempt] = useState(0);
  const selectCoordinates = useEffectEvent(
    (latitude: number, longitude: number) => {
      if (
        !editable ||
        !onChange ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      )
        return;
      onChange({
        latitude: Math.max(-90, Math.min(90, latitude)),
        longitude: ((((longitude + 180) % 360) + 360) % 360) - 180,
      });
    },
  );

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | undefined;
    let observer: ResizeObserver | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onOffline = () => setState("offline");
    window.addEventListener("offline", onOffline);
    void import("leaflet")
      .then((leaflet) => {
        if (cancelled || !container.current) return;
        map = leaflet.map(container.current, {
          center: varanasi,
          zoom: 12,
          minZoom: 2,
          maxZoom: 19,
          scrollWheelZoom: false,
          zoomAnimation: false,
          fadeAnimation: false,
          markerZoomAnimation: false,
        });
        let failed = false;
        const tiles = leaflet.tileLayer(tileUrl, {
          attribution,
          maxZoom: 19,
          updateWhenIdle: true,
        });
        const startTimeout = () => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            if (!cancelled) setState("tile-error");
          }, 15000);
        };
        tiles.on("loading", () => {
          if (cancelled) return;
          failed = false;
          setState(navigator.onLine ? "loading" : "offline");
          startTimeout();
        });
        tiles.on("tileerror", () => {
          if (cancelled) return;
          failed = true;
          setState(navigator.onLine ? "tile-error" : "offline");
        });
        tiles.on("load", () => {
          if (cancelled) return;
          clearTimeout(timer);
          setState(
            !navigator.onLine ? "offline" : failed ? "tile-error" : "ready",
          );
        });
        startTimeout();
        tiles.addTo(map);
        map.on("click", (event) =>
          selectCoordinates(event.latlng.lat, event.latlng.lng),
        );
        if (typeof ResizeObserver !== "undefined") {
          observer = new ResizeObserver(() =>
            map?.invalidateSize({ pan: false }),
          );
          observer.observe(container.current);
        }
        setRuntime({ leaflet, map });
      })
      .catch(() => {
        if (!cancelled) setState("unavailable");
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("offline", onOffline);
      observer?.disconnect();
      map?.remove();
    };
  }, [attempt]);

  const latitude = destination?.latitude;
  const longitude = destination?.longitude;
  const riderLatitude = rider?.latitude;
  const riderLongitude = rider?.longitude;
  useEffect(() => {
    if (!runtime) return;
    const { leaflet, map } = runtime;
    const markers: Marker[] = [];
    function addMarker(
      coordinates: Coordinates,
      label: string,
      isRider: boolean,
    ) {
      const caption = document.createElement("span");
      caption.textContent = label;
      const marker = leaflet
        .marker([coordinates.latitude, coordinates.longitude], {
          icon: leaflet.divIcon({
            className: `delivery-pin${isRider ? " delivery-pin-rider" : ""}`,
            html: `<span aria-hidden="true">${isRider ? "R" : "D"}</span>`,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
          }),
          title: label,
          alt: label,
          draggable: editable && !isRider,
          keyboard: true,
        })
        .addTo(map)
        .bindTooltip(caption);
      if (!isRider)
        marker.on("dragend", () => {
          const point = marker.getLatLng();
          selectCoordinates(point.lat, point.lng);
        });
      markers.push(marker);
    }
    if (latitude !== undefined && longitude !== undefined)
      addMarker({ latitude, longitude }, destinationLabel, false);
    if (riderLatitude !== undefined && riderLongitude !== undefined)
      addMarker(
        { latitude: riderLatitude, longitude: riderLongitude },
        riderLabel,
        true,
      );
    if (markers.length > 1)
      map.fitBounds(
        leaflet.latLngBounds(markers.map((marker) => marker.getLatLng())),
        { padding: [45, 45], maxZoom: 16, animate: false },
      );
    else if (markers[0])
      map.setView(markers[0].getLatLng(), 16, { animate: false });
    return () => {
      markers.forEach((marker) => marker.remove());
    };
  }, [
    runtime,
    latitude,
    longitude,
    riderLatitude,
    riderLongitude,
    destinationLabel,
    riderLabel,
    editable,
  ]);

  const failed =
    state === "tile-error" || state === "unavailable" || state === "offline";
  return (
    <div className="delivery-map-loaded">
      <div
        ref={container}
        className="delivery-map-canvas"
        role="region"
        aria-label={
          editable ? "Choose delivery location on map" : "Delivery tracking map"
        }
      />
      <div className="delivery-map-message" aria-live="polite">
        {state === "loading" && <p role="status">Loading map tiles…</p>}
        {failed && (
          <div>
            <p role="status">
              {state === "offline"
                ? "You appear to be offline. Your selected coordinates are still available."
                : state === "unavailable"
                  ? editable
                    ? "The map could not start. You can still enter coordinates manually."
                    : "The map could not start. Recorded coordinates are still available below."
                  : "Some map tiles could not load. Your selected coordinates are still available."}
            </p>
            <button
              type="button"
              className="delivery-map-button"
              onClick={() => {
                setRuntime(null);
                setState("loading");
                setAttempt((value) => value + 1);
              }}
            >
              Retry map
            </button>
          </div>
        )}
        {editable && (
          <p>
            Tap the map or drag the destination pin. You can also enter
            coordinates below.
          </p>
        )}
        {!destination && !rider && (
          <p>
            Showing Varanasi for orientation. No delivery location has been
            selected.
          </p>
        )}
      </div>
    </div>
  );
}
