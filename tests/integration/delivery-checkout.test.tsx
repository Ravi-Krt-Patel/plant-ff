import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { z } from "zod";
import { ApiCheckout } from "@/features/checkout/api-checkout";
import type { Coordinates } from "@/features/delivery/location-map";
import type { RequestOptions } from "@/features/delivery/api";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  push: vi.fn(),
  dispatch: vi.fn(),
  key: vi.fn(),
}));
vi.mock("@/features/delivery/api", () => ({
  apiEnabled: true,
  apiRequest: (...args: unknown[]) => mocks.request(...args),
  errorMessage: (error: unknown) =>
    error instanceof Error ? error.message : "Request failed",
  idempotencyKey: () => mocks.key(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/features/cart/store", () => ({
  useStore: () => ({
    lines: [{ id: "monstera", variant: "nursery", quantity: 2 }],
    dispatch: mocks.dispatch,
  }),
}));
vi.mock("@/features/delivery/location-picker", () => ({
  LocationPicker: ({
    value,
    onChange,
    disabled,
  }: {
    value: Coordinates | null;
    onChange: (value: Coordinates) => void;
    disabled?: boolean;
  }) => (
    <div>
      <output data-testid="delivery-pin">
        {value ? `${value.latitude},${value.longitude}` : "No pin selected"}
      </output>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange({ latitude: 25.3085, longitude: 83.0075 })}
      >
        Adjust delivery pin
      </button>
    </div>
  ),
}));
const address = {
  name: "Demo Recipient",
  phone: "9876543210",
  line: "12 Garden Lane",
  locality: "Lanka",
  city: "Varanasi",
  state: "Uttar Pradesh",
  pin: "221005",
  landmark: "Near the gate",
  instructions: "Ring the bell",
  latitude: 25.307,
  longitude: 83.006,
};
const preferred = { id: "address-preferred", isDefault: true, value: address };
const session = {
  sessionId: "session-one",
  userId: "user-one",
  role: "customer",
  verifiedAt: "2026-09-23T08:00:00.000Z",
};
const quote = {
  id: "quote-one",
  version: 3,
  expiresAt: "2026-09-23T11:00:00.000Z",
  totals: {
    subtotalPaise: 79800,
    discountPaise: 0,
    shippingPaise: 4900,
    taxPaise: 0,
    totalPaise: 84700,
    currency: "INR",
  },
};
const order = {
  id: "order-one",
  reference: "KG-ONE",
  snapshot: { input: { address } },
  totalPaise: 84700,
  currency: "INR",
  method: "cod",
  status: "confirmed",
  paymentState: "due_on_delivery",
  version: 1,
  createdAt: "2026-09-23T09:00:00.000Z",
  reservationExpiresAt: "2026-09-23T09:15:00.000Z",
};
let handle: (
  path: string,
  options: RequestOptions,
) => unknown | Promise<unknown>;
function defaultResponse(path: string) {
  if (path === "/auth/session") return session;
  if (path === "/addresses") return [preferred];
  if (path === "/serviceability/check")
    return {
      eligible: true,
      cod: true,
      slots: [
        {
          id: "slot-one",
          startsAt: "2026-09-24T04:30:00.000Z",
          cutoffAt: "2026-09-23T18:00:00.000Z",
        },
      ],
    };
  if (path === "/checkout/quotes") return quote;
  if (path === "/orders") return order;
  throw new Error(`Unexpected request: ${path}`);
}
beforeEach(() => {
  vi.clearAllMocks();
  let sequence = 0;
  mocks.key.mockImplementation(() => `stable-key-${++sequence}`);
  handle = defaultResponse;
  mocks.request.mockImplementation(
    async (path: string, schema: z.ZodType, options: RequestOptions = {}) =>
      schema.parse(await handle(path, options)),
  );
});
afterEach(cleanup);
function calls(path: string) {
  return mocks.request.mock.calls.filter((call) => call[0] === path);
}
async function loadedCheckout() {
  render(<ApiCheckout />);
  await waitFor(() =>
    expect(
      (screen.getByLabelText("Saved delivery address") as HTMLSelectElement)
        .value,
    ).toBe(preferred.id),
  );
}
async function checkAvailability() {
  fireEvent.click(
    screen.getByRole("button", { name: "Check delivery availability" }),
  );
  await screen.findByLabelText("Delivery slot");
}
async function reviewDelivery() {
  fireEvent.click(
    screen.getByRole("button", { name: "Review delivery and total" }),
  );
  return screen.findByRole("button", { name: /Confirm order/ });
}

describe("backend delivery checkout", () => {
  it("loads the default address and snapshots the manually corrected pin through the quote", async () => {
    await loadedCheckout();
    expect((screen.getByLabelText("Full name") as HTMLInputElement).value).toBe(
      address.name,
    );
    expect(screen.getByTestId("delivery-pin").textContent).toBe(
      "25.307,83.006",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Adjust delivery pin" }),
    );
    await checkAvailability();
    fireEvent.click(await reviewDelivery());
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith("/track-order?orderId=order-one"),
    );
    expect(calls("/checkout/quotes")[0]?.[2].body).toEqual({
      lines: [{ variantId: "monstera-nursery", quantity: 2 }],
      address: { ...address, latitude: 25.3085, longitude: 83.0075 },
      slotId: "slot-one",
      method: "cod",
    });
    expect(calls("/orders")[0]?.[2]).toEqual(
      expect.objectContaining({
        body: { quoteId: "quote-one", version: 3 },
        idempotencyKey: "stable-key-1",
      }),
    );
    expect(mocks.dispatch).toHaveBeenCalledWith({ type: "clear" });
  });

  it.each(["coordinates", "city"])(
    "blocks quote creation when required %s are absent",
    async (missing) => {
      handle = (path) =>
        path === "/addresses"
          ? [
              {
                ...preferred,
                value:
                  missing === "coordinates"
                    ? { ...address, latitude: null, longitude: null }
                    : { ...address, city: "" },
              },
            ]
          : defaultResponse(path);
      await loadedCheckout();
      await checkAvailability();
      fireEvent.click(
        screen.getByRole("button", { name: "Review delivery and total" }),
      );
      await waitFor(() =>
        expect(
          screen
            .getAllByRole("alert")
            .some((node) =>
              node.textContent?.includes(
                missing === "coordinates"
                  ? "Choose your delivery pin"
                  : "Enter your city",
              ),
            ),
        ).toBe(true),
      );
      expect(calls("/checkout/quotes")).toHaveLength(0);
      expect(calls("/orders")).toHaveLength(0);
      expect(mocks.dispatch).not.toHaveBeenCalled();
    },
  );

  it("invalidates the quote after an address edit and requires delivery recheck if the PIN changes", async () => {
    await loadedCheckout();
    await checkAvailability();
    await reviewDelivery();
    fireEvent.change(screen.getByLabelText("PIN code"), {
      target: { value: "221001" },
    });
    expect(screen.queryByRole("button", { name: /Confirm order/ })).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Review delivery and total" }),
    );
    expect(
      await screen.findByText(
        /Check delivery availability and choose a slot for this PIN first/,
      ),
    ).toBeTruthy();
    expect(calls("/checkout/quotes")).toHaveLength(1);
    expect(calls("/orders")).toHaveLength(0);
  });

  it("shows quote errors without creating a fallback order or clearing the cart", async () => {
    handle = (path) => {
      if (path === "/checkout/quotes")
        throw new Error("Delivery service unavailable");
      return defaultResponse(path);
    };
    await loadedCheckout();
    await checkAvailability();
    fireEvent.click(
      screen.getByRole("button", { name: "Review delivery and total" }),
    );
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Delivery service unavailable",
    );
    expect(calls("/orders")).toHaveLength(0);
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("reuses the order idempotency key when a create request fails and is retried", async () => {
    let attempts = 0;
    handle = (path) => {
      if (path === "/orders" && attempts++ === 0)
        throw new Error("Connection interrupted");
      return defaultResponse(path);
    };
    await loadedCheckout();
    await checkAvailability();
    fireEvent.click(await reviewDelivery());
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Connection interrupted",
    );
    expect(mocks.dispatch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Confirm order/ }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalled());
    const requests = calls("/orders");
    expect(requests).toHaveLength(2);
    expect(requests[0]?.[2]).toEqual(requests[1]?.[2]);
    expect(requests[0]?.[2].idempotencyKey).toBe("stable-key-1");
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
  });

  it("saves corrected coordinates to the selected address using its scoped route", async () => {
    handle = (path, options) =>
      path === "/addresses/address-preferred" && options.method === "PATCH"
        ? { ...preferred, value: options.body }
        : defaultResponse(path);
    await loadedCheckout();
    fireEvent.click(
      screen.getByRole("button", { name: "Adjust delivery pin" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Save address changes" }),
    );
    expect(
      await screen.findByText("Address and delivery pin saved."),
    ).toBeTruthy();
    expect(calls("/addresses/address-preferred")[0]?.[2]).toEqual({
      method: "PATCH",
      body: { ...address, latitude: 25.3085, longitude: 83.0075 },
    });
    expect(calls("/orders")).toHaveLength(0);
  });

  it("keeps one saved order and reuses its payment-session key after a payment startup failure", async () => {
    let paymentAttempts = 0;
    handle = (path) => {
      if (path === "/orders")
        return {
          ...order,
          method: "upi",
          status: "awaiting_payment",
          paymentState: "unpaid",
        };
      if (path === "/orders/order-one/payment-sessions") {
        if (paymentAttempts++ === 0)
          throw new Error("Payment provider unavailable");
        return {
          id: "payment-one",
          mode: "razorpay",
          state: "created",
          providerOrderId: "provider-one",
        };
      }
      return defaultResponse(path);
    };
    await loadedCheckout();
    fireEvent.click(screen.getByRole("radio", { name: "UPI" }));
    await checkAvailability();
    fireEvent.click(await reviewDelivery());
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Payment provider unavailable",
    );
    expect(
      screen
        .getByRole("link", { name: "View saved order" })
        .getAttribute("href"),
    ).toBe("/track-order?orderId=order-one");
    fireEvent.click(screen.getByRole("button", { name: "Continue payment" }));
    await screen.findByText(/Hosted payment checkout is not enabled/);
    const requests = calls("/orders/order-one/payment-sessions");
    expect(calls("/orders")).toHaveLength(1);
    expect(requests).toHaveLength(2);
    expect(requests[0]?.[2]).toEqual(requests[1]?.[2]);
    expect(requests[0]?.[2].idempotencyKey).toBe("stable-key-2");
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("disables repeated confirmation while an order request is pending", async () => {
    let resolveOrder: ((value: typeof order) => void) | undefined;
    handle = (path) =>
      path === "/orders"
        ? new Promise<typeof order>((resolve) => {
            resolveOrder = resolve;
          })
        : defaultResponse(path);
    await loadedCheckout();
    await checkAvailability();
    const button = await reviewDelivery();
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(calls("/orders")).toHaveLength(1));
    expect(button.getAttribute("disabled")).not.toBeNull();
    await act(async () => resolveOrder?.(order));
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    expect(mocks.push).toHaveBeenCalledTimes(1);
  });
});

describe("saved delivery order payment outcomes", () => {
  function fakePaymentResponses(path: string, options: RequestOptions) {
    if (path === "/orders") {
      return {
        ...order,
        method: "upi",
        status: "awaiting_payment",
        paymentState: "unpaid",
      };
    }
    if (path === "/orders/order-one/payment-sessions") {
      return {
        id: "payment-one",
        mode: "fake",
        state: "created",
        providerOrderId: "provider-one",
      };
    }
    if (path === "/orders/order-one/payments/simulate") {
      return { state: (options.body as { outcome: string }).outcome };
    }
    return defaultResponse(path);
  }
  async function openSavedOrderPayment() {
    handle = fakePaymentResponses;
    await loadedCheckout();
    fireEvent.click(screen.getByRole("radio", { name: "UPI" }));
    await checkAvailability();
    fireEvent.click(await reviewDelivery());
    await screen.findByRole("dialog", {}, { timeout: 5_000 });
    expect(screen.getByText("Demo order · order-one")).toBeTruthy();
  }

  it.each([
    {
      outcome: "failure",
      button: "Simulate failure",
      message: /Payment failed\. Your bag is safe/,
      nextKey: "stable-key-3",
    },
    {
      outcome: "dismissed",
      button: "Dismiss payment",
      message: /Payment dismissed\. Your order is saved/,
      nextKey: "stable-key-2",
    },
    {
      outcome: "pending",
      button: "Simulate pending",
      message: /Payment is pending\. Your order is saved/,
      nextKey: "stable-key-2",
    },
  ])(
    "keeps $outcome payment on the saved order, then completes the same order on success",
    async ({ outcome, button, message, nextKey }) => {
      await openSavedOrderPayment();
      fireEvent.click(screen.getByRole("button", { name: button }));
      await screen.findByText(message);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(mocks.dispatch).not.toHaveBeenCalled();
      expect(mocks.push).not.toHaveBeenCalled();
      expect(calls("/orders")).toHaveLength(1);
      expect(
        screen
          .getByRole("link", { name: "View saved order" })
          .getAttribute("href"),
      ).toBe("/track-order?orderId=order-one");
      expect(
        (screen.getByLabelText("Full name") as HTMLInputElement).disabled,
      ).toBe(true);
      const simulationRequests = calls("/orders/order-one/payments/simulate");
      if (outcome === "dismissed") expect(simulationRequests).toHaveLength(0);
      else
        expect(simulationRequests[0]?.[2].body).toEqual({
          outcome: outcome === "failure" ? "failed" : "pending",
        });

      const retry = screen.getByRole("button", { name: "Continue payment" });
      expect(retry.getAttribute("disabled")).toBeNull();
      fireEvent.click(retry);
      await screen.findByRole("dialog", {}, { timeout: 5_000 });
      expect(calls("/orders")).toHaveLength(1);
      expect(calls("/checkout/quotes")).toHaveLength(1);
      const sessions = calls("/orders/order-one/payment-sessions");
      expect(sessions).toHaveLength(2);
      expect(sessions[0]?.[2].idempotencyKey).toBe("stable-key-2");
      expect(sessions[1]?.[2].idempotencyKey).toBe(nextKey);
      expect(mocks.dispatch).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Simulate success" }));
      await waitFor(() =>
        expect(mocks.push).toHaveBeenCalledWith(
          "/track-order?orderId=order-one",
        ),
      );
      expect(mocks.dispatch).toHaveBeenCalledTimes(1);
      expect(mocks.dispatch).toHaveBeenCalledWith({ type: "clear" });
      expect(mocks.push).toHaveBeenCalledTimes(1);
      expect(calls("/orders")).toHaveLength(1);
      expect(
        calls("/orders/order-one/payments/simulate").at(-1)?.[2].body,
      ).toEqual({ outcome: "captured" });
    },
  );

  it("closing the dialog preserves the saved order and active payment-session key", async () => {
    await openSavedOrderPayment();
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    await screen.findByText(/Payment was dismissed\. Your order is saved/);
    expect(calls("/orders/order-one/payments/simulate")).toHaveLength(0);
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Continue payment" }));
    await screen.findByRole("dialog", {}, { timeout: 5_000 });
    const sessions = calls("/orders/order-one/payment-sessions");
    expect(sessions).toHaveLength(2);
    expect(sessions[0]?.[2]).toEqual(sessions[1]?.[2]);
    expect(sessions[0]?.[2].idempotencyKey).toBe("stable-key-2");
    expect(calls("/orders")).toHaveLength(1);
  });
});
