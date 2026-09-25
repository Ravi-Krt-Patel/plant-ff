"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LocateFixed } from "lucide-react";
import {
  LocationMap,
  validCoordinates,
  type Coordinates,
} from "./location-map";

export type LocationPickerProps = {
  value: Coordinates | null;
  onChange: (value: Coordinates) => void;
  disabled?: boolean;
};

function ManualCoordinates({ value, onChange, disabled }: LocationPickerProps) {
  const id = useId();
  const [latitude, setLatitude] = useState(value?.latitude.toString() ?? "");
  const [longitude, setLongitude] = useState(value?.longitude.toString() ?? "");
  const [error, setError] = useState("");
  function apply() {
    const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
    const next = {
      latitude: Number(latitude.trim()),
      longitude: Number(longitude.trim()),
    };
    if (
      !decimal.test(latitude.trim()) ||
      !decimal.test(longitude.trim()) ||
      !validCoordinates(next)
    ) {
      setError(
        "Enter a latitude from −90 to 90 and a longitude from −180 to 180.",
      );
      return;
    }
    setError("");
    onChange(next);
  }
  return (
    <details className="delivery-coordinate-entry">
      <summary>Enter latitude and longitude manually</summary>
      <p>Use coordinates from a trusted map or a location shared with you.</p>
      <div className="delivery-coordinate-inputs">
        <label htmlFor={`${id}-latitude`}>
          Latitude
          <input
            id={`${id}-latitude`}
            type="text"
            inputMode="decimal"
            value={latitude}
            onChange={(event) => setLatitude(event.target.value)}
            disabled={disabled}
            autoComplete="off"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            placeholder="e.g. 25.3176"
          />
        </label>
        <label htmlFor={`${id}-longitude`}>
          Longitude
          <input
            id={`${id}-longitude`}
            type="text"
            inputMode="decimal"
            value={longitude}
            onChange={(event) => setLongitude(event.target.value)}
            disabled={disabled}
            autoComplete="off"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            placeholder="e.g. 82.9739"
          />
        </label>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="delivery-location-error">
          {error}
        </p>
      )}
      <button
        type="button"
        className="delivery-map-button"
        disabled={disabled}
        onClick={apply}
      >
        Use these coordinates
      </button>
    </details>
  );
}

export function LocationPicker({
  value,
  onChange,
  disabled = false,
}: LocationPickerProps) {
  const id = useId();
  const [locating, setLocating] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);
  const requestNumber = useRef(0);
  const isDisabled = useRef(disabled);
  useEffect(() => {
    isDisabled.current = disabled;
  }, [disabled]);
  useEffect(
    () => () => {
      requestNumber.current += 1;
    },
    [],
  );

  function selectManually(coordinates: Coordinates) {
    if (disabled) return;
    requestNumber.current += 1;
    setLocating(false);
    setFailed(false);
    setFeedback(
      "Delivery pin updated. Check that it matches your written address and entrance.",
    );
    onChange(coordinates);
  }
  function locate() {
    if (disabled || locating) return;
    if (window.isSecureContext === false || !navigator.geolocation) {
      setFailed(true);
      setFeedback(
        "Device location is unavailable here. Use HTTPS (or localhost), choose a pin on the map, or enter coordinates manually.",
      );
      return;
    }
    setLocating(true);
    setFailed(false);
    setFeedback("Waiting for your browser's location permission…");
    const request = ++requestNumber.current;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (request !== requestNumber.current) return;
        setLocating(false);
        if (isDisabled.current) return;
        const coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        if (!validCoordinates(coordinates)) {
          setFailed(true);
          setFeedback(
            "Your device returned an invalid location. Choose a pin on the map or enter coordinates manually.",
          );
          return;
        }
        onChange(coordinates);
        const accuracy = Number.isFinite(position.coords.accuracy)
          ? ` (reported accuracy: about ${Math.ceil(position.coords.accuracy)} metres)`
          : "";
        setFeedback(
          `Location detected${accuracy}. Check the pin and move it to your entrance if needed.`,
        );
      },
      (error) => {
        if (request !== requestNumber.current) return;
        setLocating(false);
        setFailed(true);
        setFeedback(
          error.code === 1
            ? "Location permission was denied. You can enable it in your browser settings, choose a pin on the map, or enter coordinates manually."
            : error.code === 3
              ? "Finding your location timed out. Try again, choose a pin on the map, or enter coordinates manually."
              : "Your device could not determine your location. Try again, choose a pin on the map, or enter coordinates manually.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  return (
    <fieldset
      className="delivery-location-picker"
      disabled={disabled}
      aria-describedby={`${id}-help`}
    >
      <legend>Exact delivery location</legend>
      <p id={`${id}-help`}>
        Choose the building entrance where you want your plants delivered. Keep
        your full written address as well.
      </p>
      <button
        className="delivery-map-button"
        type="button"
        disabled={disabled || locating}
        onClick={locate}
      >
        <LocateFixed size={18} aria-hidden="true" />
        {locating ? "Finding your location…" : "Use my current location"}
      </button>
      {feedback && (
        <p
          role={failed ? "alert" : "status"}
          className={
            failed ? "delivery-location-error" : "delivery-location-feedback"
          }
        >
          {feedback}
        </p>
      )}
      <LocationMap
        destination={value}
        editable={!disabled}
        onChange={selectManually}
      />
      <ManualCoordinates
        key={value ? `${value.latitude},${value.longitude}` : "unselected"}
        value={value}
        onChange={selectManually}
        disabled={disabled}
      />
    </fieldset>
  );
}
