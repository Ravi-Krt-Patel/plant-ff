import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import MapCanvas from "@/features/delivery/map-canvas";

const state = vi.hoisted(() => ({
  mapHandlers: {} as Record<
    string,
    (event: { latlng: { lat: number; lng: number } }) => void
  >,
  tileHandlers: {} as Record<string, () => void>,
  markerHandlers: [] as Record<string, () => void>[],
  markers: [] as {
    coordinates: number[];
    options: Record<string, unknown>;
    tooltip?: HTMLElement;
  }[],
  fitBounds: vi.fn(),
  setView: vi.fn(),
  remove: vi.fn(),
  map: vi.fn(),
  fail: false,
}));
vi.mock("leaflet", () => ({
  map: (...args: unknown[]) => {
    state.map(...args);
    if (state.fail) throw new Error("Library unavailable");
    return {
      on: (event: string, callback: (typeof state.mapHandlers)[string]) => {
        state.mapHandlers[event] = callback;
      },
      fitBounds: state.fitBounds,
      setView: state.setView,
      remove: state.remove,
      invalidateSize: vi.fn(),
    };
  },
  tileLayer: () => {
    const layer = {
      on: (event: string, callback: () => void) => {
        state.tileHandlers[event] = callback;
        return layer;
      },
      addTo: () => layer,
    };
    return layer;
  },
  marker: (coordinates: number[], options: Record<string, unknown>) => {
    const record: (typeof state.markers)[number] = { coordinates, options };
    state.markers.push(record);
    const handlers: Record<string, () => void> = {};
    state.markerHandlers.push(handlers);
    const marker = {
      addTo: () => marker,
      bindTooltip: (tooltip: HTMLElement) => {
        record.tooltip = tooltip;
        return marker;
      },
      on: (event: string, callback: () => void) => {
        handlers[event] = callback;
        return marker;
      },
      getLatLng: () => ({ lat: coordinates[0], lng: coordinates[1] }),
      remove: vi.fn(),
    };
    return marker;
  },
  divIcon: (options: unknown) => options,
  latLngBounds: (coordinates: unknown) => coordinates,
}));
beforeEach(() => {
  vi.clearAllMocks();
  state.mapHandlers = {};
  state.tileHandlers = {};
  state.markerHandlers = [];
  state.markers = [];
  state.fail = false;
});
afterEach(cleanup);

describe("delivery map canvas", () => {
  it("places only supplied locations and fits both markers without a fabricated route", async () => {
    render(
      <MapCanvas
        destination={{ latitude: 25.1, longitude: 83.2 }}
        rider={{ latitude: 25.11, longitude: 83.21 }}
        riderLabel="Driver's reported position"
      />,
    );
    await waitFor(() => expect(state.markers).toHaveLength(2));
    expect(state.markers[0]?.coordinates).toEqual([25.1, 83.2]);
    expect(state.markers[1]?.coordinates).toEqual([25.11, 83.21]);
    expect(state.markers[1]?.tooltip?.textContent).toBe(
      "Driver's reported position",
    );
    expect(state.fitBounds).toHaveBeenCalledWith(
      [
        { lat: 25.1, lng: 83.2 },
        { lat: 25.11, lng: 83.21 },
      ],
      expect.objectContaining({ animate: false }),
    );
    act(() => state.tileHandlers.load?.());
    expect(screen.queryByText("Loading map tiles…")).toBeNull();
  });

  it("does not create a marker from the default city center", async () => {
    const onChange = vi.fn();
    render(<MapCanvas destination={null} editable onChange={onChange} />);
    await waitFor(() => expect(state.map).toHaveBeenCalled());
    expect(state.markers).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/Showing Varanasi for orientation/)).toBeTruthy();
    act(() => state.mapHandlers.click?.({ latlng: { lat: 25.3, lng: 443.1 } }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: 25.3,
        longitude: expect.closeTo(83.1),
      }),
    );
  });

  it("makes only the destination draggable in editing mode and ignores read-only clicks", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <MapCanvas
        destination={{ latitude: 25.3, longitude: 83 }}
        editable
        onChange={onChange}
      />,
    );
    await waitFor(() => expect(state.markers).toHaveLength(1));
    expect(state.markers[0]?.options.draggable).toBe(true);
    act(() => state.markerHandlers[0]?.dragend?.());
    expect(onChange).toHaveBeenCalledWith({ latitude: 25.3, longitude: 83 });
    onChange.mockClear();
    rerender(
      <MapCanvas
        destination={{ latitude: 25.3, longitude: 83 }}
        onChange={onChange}
      />,
    );
    act(() => state.mapHandlers.click?.({ latlng: { lat: 1, lng: 1 } }));
    expect(onChange).not.toHaveBeenCalled();
    expect(state.markers.at(-1)?.options.draggable).toBe(false);
  });

  it("retains coordinates on tile failures and can rebuild the map on retry", async () => {
    render(<MapCanvas destination={{ latitude: 25.3, longitude: 83 }} />);
    await waitFor(() => expect(state.map).toHaveBeenCalledTimes(1));
    act(() => state.tileHandlers.tileerror?.());
    expect(screen.getByText(/Some map tiles could not load/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry map" }));
    await waitFor(() => expect(state.map).toHaveBeenCalledTimes(2));
    expect(state.remove).toHaveBeenCalledTimes(1);
    expect(state.markers.at(-1)?.coordinates).toEqual([25.3, 83]);
  });

  it("shows a recoverable error if initialization fails", async () => {
    state.fail = true;
    render(<MapCanvas destination={null} editable />);
    expect(await screen.findByText(/The map could not start/)).toBeTruthy();
    state.fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry map" }));
    await waitFor(() => expect(state.map).toHaveBeenCalledTimes(2));
  });
});
