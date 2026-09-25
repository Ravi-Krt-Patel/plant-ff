import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { LocationPicker } from "@/features/delivery/location-picker";
import {
  LocationMap,
  validCoordinates,
  type Coordinates,
} from "@/features/delivery/location-map";

vi.mock("@/features/delivery/map-canvas", () => ({
  default: ({ onChange }: { onChange?: (value: Coordinates) => void }) => (
    <div data-testid="map-canvas">
      <button
        type="button"
        onClick={() => onChange?.({ latitude: 25.308, longitude: 83.006 })}
      >
        Select map pin
      </button>
    </div>
  ),
}));

const getCurrentPosition = vi.fn();
const originalGeolocation = Object.getOwnPropertyDescriptor(
  navigator,
  "geolocation",
);
beforeEach(() => {
  getCurrentPosition.mockReset();
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition },
  });
  vi.stubGlobal("isSecureContext", true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (originalGeolocation)
    Object.defineProperty(navigator, "geolocation", originalGeolocation);
  else Reflect.deleteProperty(navigator, "geolocation");
});
function Picker() {
  const [value, setValue] = useState<Coordinates | null>(null);
  return <LocationPicker value={value} onChange={setValue} />;
}

describe("delivery location selection", () => {
  it("does not request location or mount the map without explicit user action", () => {
    render(<Picker />);
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(screen.queryByTestId("map-canvas")).toBeNull();
    expect(screen.getByText(/No pin selected/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Load map" }));
    expect(screen.getByTestId("map-canvas")).toBeTruthy();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Select map pin" }));
    expect(screen.getByText(/25.308000, 83.006000/)).toBeTruthy();
  });

  it("requests high-accuracy location on demand and lets the user correct it", () => {
    render(<Picker />);
    getCurrentPosition.mockImplementation((success) =>
      success({ coords: { latitude: 25.31, longitude: 82.97, accuracy: 50 } }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Use my current location" }),
    );
    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
    expect(screen.getByText(/reported accuracy: about 50 metres/)).toBeTruthy();
    expect(screen.getByText(/25.310000, 82.970000/)).toBeTruthy();
    fireEvent.click(screen.getByText("Enter latitude and longitude manually"));
    fireEvent.change(screen.getByLabelText("Latitude"), {
      target: { value: "25.309" },
    });
    fireEvent.change(screen.getByLabelText("Longitude"), {
      target: { value: "83.007" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Use these coordinates" }),
    );
    expect(screen.getByText(/25.309000, 83.007000/)).toBeTruthy();
  });

  it.each([
    [1, /Location permission was denied/],
    [2, /could not determine your location/],
    [3, /Finding your location timed out/],
  ])(
    "handles browser geolocation failure %s without selecting an invented location",
    (code, message) => {
      getCurrentPosition.mockImplementation((_success, failure) =>
        failure({ code }),
      );
      render(<Picker />);
      fireEvent.click(
        screen.getByRole("button", { name: "Use my current location" }),
      );
      expect(screen.getByRole("alert").textContent).toMatch(message);
      expect(screen.getByText(/No pin selected/)).toBeTruthy();
      expect(
        screen
          .getByRole("button", { name: "Use my current location" })
          .getAttribute("disabled"),
      ).toBeNull();
    },
  );

  it("allows manual coordinates offline and rejects blank, non-finite and out-of-range values", () => {
    const onChange = vi.fn();
    render(<LocationPicker value={null} onChange={onChange} />);
    fireEvent.click(screen.getByText("Enter latitude and longitude manually"));
    for (const [latitude, longitude] of [
      ["", ""],
      ["NaN", "83"],
      ["91", "83"],
      ["25", "181"],
      ["25xyz", "83"],
    ]) {
      fireEvent.change(screen.getByLabelText("Latitude"), {
        target: { value: latitude },
      });
      fireEvent.change(screen.getByLabelText("Longitude"), {
        target: { value: longitude },
      });
      fireEvent.click(
        screen.getByRole("button", { name: "Use these coordinates" }),
      );
      expect(screen.getByRole("alert").textContent).toContain(
        "Enter a latitude",
      );
    }
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Latitude"), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByLabelText("Longitude"), {
      target: { value: "0" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Use these coordinates" }),
    );
    expect(onChange).toHaveBeenCalledWith({ latitude: 0, longitude: 0 });
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("ignores a late GPS response after a manual pin change", () => {
    let resolve:
      | ((position: {
          coords: { latitude: number; longitude: number; accuracy: number };
        }) => void)
      | undefined;
    getCurrentPosition.mockImplementation((success) => {
      resolve = success;
    });
    render(<Picker />);
    fireEvent.click(
      screen.getByRole("button", { name: "Use my current location" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Load map" }));
    fireEvent.click(screen.getByRole("button", { name: "Select map pin" }));
    resolve?.({ coords: { latitude: 0, longitude: 0, accuracy: 500 } });
    expect(screen.getByText(/25.308000, 83.006000/)).toBeTruthy();
    expect(screen.queryByText(/0.000000, 0.000000/)).toBeNull();
  });

  it("does not expose an invented rider marker for legacy tracking", () => {
    render(<LocationMap destination={null} />);
    expect(screen.getByText(/Coordinates not recorded/)).toBeTruthy();
    expect(screen.queryByText(/Latest delivery location:/)).toBeNull();
    expect(validCoordinates({ latitude: Infinity, longitude: 25 })).toBe(false);
  });
});
