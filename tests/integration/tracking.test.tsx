import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type {
  BackendOrder,
  TrackingSnapshot,
} from "@/features/delivery/contracts";
import {
  backendOrderSchema,
  trackingSchema,
  deliveryAddressSchema,
} from "@/features/delivery/contracts";
import { ApiError, apiRequest } from "@/features/delivery/api";
import {
  ApiOrderList,
  GuestOrderRecovery,
  TrackingContent,
  TrackingOrder,
} from "@/features/orders/api-tracking";

vi.mock("@/features/delivery/api", () => ({
  apiRequest: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(
      public code: string,
      message: string,
      public status = 0,
    ) {
      super(message);
    }
  },
}));
vi.mock("@/features/delivery/location-map", () => ({
  LocationMap: ({
    destination,
    rider,
    riderLabel,
  }: {
    destination: unknown;
    rider?: unknown;
    riderLabel?: string;
  }) => (
    <div
      data-testid="tracking-map"
      data-destination={JSON.stringify(destination)}
      data-rider={JSON.stringify(rider ?? null)}
    >
      {riderLabel}
    </div>
  ),
}));
const orderId = "74bc8d2c-a71d-44ac-b228-c716e239e3e7";
const address = {
  name: "Plant Friend",
  phone: "9999999999",
  line: "24 Garden Lane",
  locality: "Lanka",
  city: "Varanasi",
  state: "Uttar Pradesh",
  pin: "221005",
  latitude: 25.28,
  longitude: 82.99,
};
const order: BackendOrder = {
  id: orderId,
  reference: "KG-TEST-ORDER",
  snapshot: { input: { address } },
  totalPaise: 74800,
  currency: "INR",
  method: "cod",
  status: "out_for_delivery",
  paymentState: "due",
  version: 1,
  createdAt: "2026-09-23T04:00:00.000Z",
  reservationExpiresAt: "2026-09-23T04:15:00.000Z",
};
const tracking: TrackingSnapshot = {
  orderId,
  status: "out_for_delivery",
  version: 1,
  timeline: [
    { status: "confirmed", createdAt: "2026-09-23T04:00:00.000Z" },
    { status: "out_for_delivery", createdAt: "2026-09-23T05:00:00.000Z" },
  ],
  simulation: false,
  destination: address,
  estimatedDelivery: null,
  location: null,
};
const request = vi.mocked(apiRequest);
function returnOrder() {
  request.mockImplementation(async (path) =>
    path.endsWith("/tracking") ? tracking : (order as never),
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("tracking destination and recorded location", () => {
  it("shows the saved destination without creating a delivery-agent position", () => {
    render(<TrackingContent order={order} tracking={tracking} />);
    expect(screen.getByText(/24 Garden Lane/)).toBeTruthy();
    expect(
      screen.getByTestId("tracking-map").getAttribute("data-destination"),
    ).toBe(JSON.stringify({ latitude: 25.28, longitude: 82.99 }));
    expect(screen.getByTestId("tracking-map").getAttribute("data-rider")).toBe(
      "null",
    );
    expect(
      screen.getByText(/No delivery-agent location is currently available/),
    ).toBeTruthy();
    expect(screen.queryByText(/Estimated delivery:/)).toBeNull();
  });
  it("keeps legacy address and status visible when no coordinates were recorded", () => {
    const legacy = { ...address, latitude: undefined, longitude: undefined };
    render(
      <TrackingContent
        order={{ ...order, snapshot: { input: { address: legacy } } }}
        tracking={{ ...tracking, destination: legacy }}
      />,
    );
    expect(
      screen.getByText("No delivery pin saved for this order."),
    ).toBeTruthy();
    expect(screen.queryByTestId("tracking-map")).toBeNull();
    expect(screen.getAllByText("Out for delivery")).toHaveLength(2);
  });
  it("labels a stale reported rider location and displays its recorded time", () => {
    render(
      <TrackingContent
        order={order}
        tracking={{
          ...tracking,
          location: {
            latitude: 25.3,
            longitude: 82.98,
            accuracy: 15,
            recordedAt: "2026-09-23T05:00:00.000Z",
            receivedAt: "2026-09-23T05:00:01.000Z",
            stale: true,
            source: "rider",
          },
        }}
      />,
    );
    expect(screen.getByTestId("tracking-map").getAttribute("data-rider")).toBe(
      JSON.stringify({ latitude: 25.3, longitude: 82.98 }),
    );
    expect(screen.getByText(/This location is stale/)).toBeTruthy();
    expect(screen.getByText(/accuracy approximately 15 metres/)).toBeTruthy();
  });
  it("labels simulations and never shows a rider marker after delivery", () => {
    render(
      <TrackingContent
        order={order}
        tracking={{
          ...tracking,
          simulation: true,
          status: "delivered",
          location: {
            latitude: 25.3,
            longitude: 82.98,
            accuracy: 15,
            recordedAt: "2026-09-23T05:00:00.000Z",
            receivedAt: "2026-09-23T05:00:01.000Z",
            stale: false,
          },
        }}
      />,
    );
    expect(screen.getByText(/delivery updates are simulated/)).toBeTruthy();
    expect(screen.getByTestId("tracking-map").getAttribute("data-rider")).toBe(
      "null",
    );
  });
});

describe("owned order fetching", () => {
  it("refreshes order and tracking together and removes protected data after access is lost", async () => {
    returnOrder();
    render(<TrackingOrder orderId={orderId} />);
    await screen.findByText("KG-TEST-ORDER");
    request.mockRejectedValue(
      new ApiError("not_found", "Private detail must not appear", 404),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh delivery status" }),
    );
    await screen.findByText(
      /This order is unavailable in your current session/,
    );
    expect(screen.queryByText("KG-TEST-ORDER")).toBeNull();
    expect(screen.queryByText(/24 Garden Lane/)).toBeNull();
    expect(screen.queryByText(/Private detail/)).toBeNull();
  });
  it("retains the latest known snapshot on a network error and supports retry", async () => {
    returnOrder();
    render(<TrackingOrder orderId={orderId} />);
    await screen.findByText("KG-TEST-ORDER");
    request.mockRejectedValue(
      new ApiError("unavailable", "Network unavailable"),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh delivery status" }),
    );
    await screen.findByText(/We couldn’t get the latest order information/);
    expect(screen.getByText("KG-TEST-ORDER")).toBeTruthy();
    returnOrder();
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh delivery status" }),
    );
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
  it("polls only while visible and aborts requests on unmount", async () => {
    vi.useFakeTimers();
    returnOrder();
    const view = render(<TrackingOrder orderId={orderId} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(request).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(request).toHaveBeenCalledTimes(4);
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    fireEvent(document, new Event("visibilitychange"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(request).toHaveBeenCalledTimes(4);
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    fireEvent(document, new Event("visibilitychange"));
    await act(async () => {
      await Promise.resolve();
    });
    expect(request).toHaveBeenCalledTimes(6);
    const signal = request.mock.calls[4]?.[2]?.signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });
  it("lists backend orders with query-based tracking links", async () => {
    request.mockResolvedValue({ items: [order], nextCursor: null });
    render(<ApiOrderList />);
    const link = await screen.findByRole("link", { name: /KG-TEST-ORDER/ });
    expect(link.getAttribute("href")).toBe(`/track-order?orderId=${orderId}`);
  });
});

describe("guest order access recovery", () => {
  const challenge = {
    challengeId: "local-challenge-id",
    expiresInSeconds: 300,
    delivery: "local_outbox",
  };
  it("validates the order ID and checkout phone before requesting access", () => {
    render(<GuestOrderRecovery onVerified={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Request verification code" }),
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "complete order ID",
    );
    expect(request).not.toHaveBeenCalled();
  });
  it("requests a scoped challenge and explains local OTP retrieval without exposing a code", async () => {
    const verified = vi.fn();
    request
      .mockResolvedValueOnce(challenge)
      .mockResolvedValueOnce({ accessGranted: true, expiresInSeconds: 1800 });
    render(<GuestOrderRecovery orderId={orderId} onVerified={verified} />);
    fireEvent.change(screen.getByLabelText("Mobile number used at checkout"), {
      target: { value: "9999999999" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Request verification code" }),
    );
    await screen.findByText(/SMS delivery is not enabled/);
    expect(screen.getByText("pnpm dev:otp local-challenge-id")).toBeTruthy();
    expect(
      (screen.getByLabelText("Verification code") as HTMLInputElement).value,
    ).toBe("");
    expect(request).toHaveBeenNthCalledWith(
      1,
      "/guest-order-access/request",
      expect.anything(),
      expect.objectContaining({
        method: "POST",
        body: { orderId, phone: "9999999999" },
      }),
    );
    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: "654321" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Verify and track order" }),
    );
    await waitFor(() => expect(verified).toHaveBeenCalledWith(orderId));
    expect(request).toHaveBeenNthCalledWith(
      2,
      "/guest-order-access/verify",
      expect.anything(),
      expect.objectContaining({
        method: "POST",
        body: { challengeId: "local-challenge-id", code: "654321" },
      }),
    );
  });
  it("does not disclose order details on verification failure", async () => {
    const verified = vi.fn();
    request
      .mockResolvedValueOnce(challenge)
      .mockRejectedValueOnce(
        new ApiError("verification_failed", "Sensitive backend detail", 400),
      );
    render(<GuestOrderRecovery orderId={orderId} onVerified={verified} />);
    fireEvent.change(screen.getByLabelText("Mobile number used at checkout"), {
      target: { value: "9999999999" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Request verification code" }),
    );
    await screen.findByLabelText("Verification code");
    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: "111111" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Verify and track order" }),
    );
    await screen.findByText(/The code is incorrect or expired/);
    expect(screen.queryByText("Sensitive backend detail")).toBeNull();
    expect(verified).not.toHaveBeenCalled();
  });
});

describe("historical order address contracts", () => {
  it("normalizes optional null text without losing the legacy address or inventing a pin", () => {
    const legacy = {
      ...address,
      city: null,
      state: null,
      landmark: null,
      instructions: null,
      latitude: null,
      longitude: null,
    };
    const parsedOrder = backendOrderSchema.parse({
      ...order,
      snapshot: { input: { address: legacy } },
    });
    const parsedTracking = trackingSchema.parse({
      ...tracking,
      destination: legacy,
    });
    expect(parsedOrder.snapshot.input.address).toMatchObject({
      name: address.name,
      line: address.line,
      city: undefined,
      state: undefined,
      landmark: undefined,
      instructions: undefined,
    });
    render(<TrackingContent order={parsedOrder} tracking={parsedTracking} />);
    expect(screen.getByText(/24 Garden Lane/)).toBeTruthy();
    expect(
      screen.getByText("No delivery pin saved for this order."),
    ).toBeTruthy();
    expect(screen.queryByTestId("tracking-map")).toBeNull();
  });
  it("keeps new delivery submissions strict and prefers the normalized tracking destination", () => {
    const complete = { ...address, landmark: "", instructions: "" };
    for (const field of [
      "city",
      "state",
      "landmark",
      "instructions",
    ] as const) {
      expect(
        deliveryAddressSchema.safeParse({ ...complete, [field]: null }).success,
      ).toBe(false);
    }
    render(
      <TrackingContent
        order={order}
        tracking={trackingSchema.parse({
          ...tracking,
          destination: {
            ...complete,
            line: "32 Correct snapshot street",
            landmark: null,
            instructions: null,
          },
        })}
      />,
    );
    expect(screen.getByText(/32 Correct snapshot street/)).toBeTruthy();
    expect(screen.queryByText(/24 Garden Lane/)).toBeNull();
  });
  it.each([
    { simulation: true, source: "device" },
    { simulation: false, source: "simulation" },
    { simulation: false, source: "simulated" },
  ])(
    "never draws a simulated delivery-agent position for %o",
    ({ simulation, source }) => {
      render(
        <TrackingContent
          order={order}
          tracking={{
            ...tracking,
            simulation,
            location: {
              latitude: 25.3,
              longitude: 82.98,
              accuracy: 15,
              recordedAt: "2026-09-23T05:00:00.000Z",
              receivedAt: "2026-09-23T05:00:01.000Z",
              stale: false,
              source,
            },
          }}
        />,
      );
      expect(
        screen.getByTestId("tracking-map").getAttribute("data-rider"),
      ).toBe("null");
      expect(
        screen.getByText(/Only simulated delivery-agent data is available/),
      ).toBeTruthy();
    },
  );
});
