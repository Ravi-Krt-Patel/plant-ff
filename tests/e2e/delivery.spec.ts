import { expect, test, type Page } from "@playwright/test";
import type { DeliveryAddress } from "../../src/features/delivery/contracts";

test.skip(!process.env.DELIVERY_API_E2E, "Requires an API-mode frontend build");
const orderId = "7c6df8cc-b1c3-47e6-8bcb-c599de520ed7";
const address: DeliveryAddress = {
  name: "Test Plant Recipient",
  phone: "9876543210",
  line: "12 Garden Lane",
  locality: "Lanka",
  city: "Varanasi",
  state: "Uttar Pradesh",
  pin: "221005",
  landmark: "Blue gate",
  instructions: "Ring the bell",
  latitude: 25.307,
  longitude: 83.006,
};

async function apiFixture(page: Page) {
  const state = { address: { ...address }, created: 0, delivery: false };
  const order = () => ({
    id: orderId,
    reference: "KG-BROWSER-TEST",
    snapshot: { input: { address: state.address } },
    totalPaise: 84700,
    currency: "INR",
    method: "cod",
    status: state.delivery ? "out_for_delivery" : "confirmed",
    paymentState: "due_on_delivery",
    version: state.delivery ? 2 : 1,
    createdAt: "2026-09-23T09:00:00.000Z",
    reservationExpiresAt: "2026-09-23T09:15:00.000Z",
  });
  await page.route("http://localhost:4000/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/v1", "");
    const headers = {
      "Access-Control-Allow-Origin": new URL(page.url()).origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers":
        "Content-Type, X-CSRF-Token, Idempotency-Key",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    };
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    let data: unknown;
    if (path === "/auth/csrf") data = { csrfToken: "browser-csrf" };
    else if (path === "/auth/session")
      data = {
        sessionId: "test-session",
        userId: "test-user",
        role: "customer",
        verifiedAt: "2026-09-23T08:00:00.000Z",
      };
    else if (path === "/addresses")
      data = [{ id: "saved-address", value: address, isDefault: true }];
    else if (path === "/serviceability/check")
      data = {
        eligible: true,
        cod: true,
        slots: [
          {
            id: "test-slot",
            startsAt: "2026-09-24T04:30:00.000Z",
            cutoffAt: "2026-09-23T18:00:00.000Z",
          },
        ],
      };
    else if (path === "/checkout/quotes") {
      expect(request.headers()["x-csrf-token"]).toBe("browser-csrf");
      state.address = request.postDataJSON().address;
      data = {
        id: "test-quote",
        version: 1,
        expiresAt: "2026-09-24T00:00:00.000Z",
        totals: {
          subtotalPaise: 79800,
          discountPaise: 0,
          shippingPaise: 4900,
          taxPaise: 0,
          totalPaise: 84700,
          currency: "INR",
        },
      };
    } else if (path === "/orders" && request.method() === "POST") {
      expect(request.headers()["idempotency-key"]).toBeTruthy();
      state.created++;
      data = order();
    } else if (path === `/orders/${orderId}`) data = order();
    else if (path === `/orders/${orderId}/tracking`)
      data = {
        orderId,
        status: state.delivery ? "out_for_delivery" : "confirmed",
        version: state.delivery ? 2 : 1,
        simulation: false,
        destination: state.address,
        estimatedDelivery: "2026-09-24T04:30:00.000Z",
        timeline: [
          { status: "confirmed", createdAt: "2026-09-23T09:00:00.000Z" },
        ],
        location: state.delivery
          ? {
              latitude: 25.31,
              longitude: 83.008,
              accuracy: 12,
              source: "device",
              recordedAt: "2026-09-23T10:00:00.000Z",
              receivedAt: "2026-09-23T10:00:01.000Z",
              stale: true,
            }
          : null,
      };
    else
      throw new Error(
        `Unhandled delivery API fixture: ${request.method()} ${path}`,
      );
    await route.fulfill({ json: { data }, headers });
  });
  // Force the provider outage path while still exercising the real Leaflet canvas.
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  return state;
}

async function openCheckout(page: Page) {
  await page.goto("/products/monstera-deliciosa");
  await page.getByRole("button", { name: "Add to your bag" }).click();
  await page.goto("/checkout");
  await expect(page.getByLabel("Saved delivery address")).toHaveValue(
    "saved-address",
  );
}

test("saved address, permitted GPS, manual map correction, COD and reported tracking", async ({
  page,
  context,
}) => {
  const state = await apiFixture(page);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({
    latitude: 25.308,
    longitude: 83.007,
    accuracy: 20,
  });
  await openCheckout(page);
  await expect(
    page.getByText("Delivery destination: 25.307000, 83.006000"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Use my current location" }).click();
  await expect(page.getByText(/Location detected/)).toBeVisible();
  await expect(
    page.getByText("Delivery destination: 25.308000, 83.007000"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Load map" }).click();
  const map = page.getByRole("region", {
    name: "Choose delivery location on map",
  });
  await expect(map.locator(".delivery-pin")).toHaveCount(1);
  await map.click({ position: { x: 120, y: 150 } });
  await expect(page.getByText(/Delivery pin updated/)).toBeVisible();
  await expect(page.getByText(/Some map tiles could not load/)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/delivery-checkout-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Check delivery availability" })
    .click();
  await expect(page.getByLabel("Delivery slot")).toHaveValue("test-slot");
  await page.getByRole("button", { name: "Review delivery and total" }).click();
  await page.getByRole("button", { name: /Confirm order/ }).click();
  await expect(page).toHaveURL(
    new RegExp(`track-order/?\\?orderId=${orderId}`),
  );
  expect(state.created).toBe(1);
  expect(state.address.latitude).not.toBe(25.308);
  expect(state.address.line).toBe(address.line);
  await expect(
    page.getByText(/No delivery-agent location is currently available/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Load map" }).click();
  await expect(page.locator(".delivery-pin")).toHaveCount(1);
  await expect(page.locator(".delivery-pin-rider")).toHaveCount(0);
  state.delivery = true;
  await page.getByRole("button", { name: "Refresh delivery status" }).click();
  await expect(
    page.getByText("Out for delivery", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".delivery-pin-rider")).toHaveCount(1);
  await expect(page.getByText(/This location is stale/)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/delivery-tracking-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("denied GPS keeps the saved pin and supports explicit coordinate correction", async ({
  page,
}) => {
  await apiFixture(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (
          _success: unknown,
          failure: (error: { code: number }) => void,
        ) => failure({ code: 1 }),
      },
    });
  });
  await openCheckout(page);
  await expect(page.getByText(/Location permission was denied/)).toHaveCount(0);
  await page.getByRole("button", { name: "Use my current location" }).click();
  await expect(page.getByText(/Location permission was denied/)).toBeVisible();
  await expect(
    page.getByText("Delivery destination: 25.307000, 83.006000"),
  ).toBeVisible();
  await page
    .getByText("Enter latitude and longitude manually", { exact: true })
    .click();
  await page.getByLabel("Latitude", { exact: true }).fill("25.3095");
  await page.getByLabel("Longitude", { exact: true }).fill("83.0085");
  await page.getByRole("button", { name: "Use these coordinates" }).click();
  await expect(
    page.getByText("Delivery destination: 25.309500, 83.008500"),
  ).toBeVisible();
  await expect(page.getByText(/Location permission was denied/)).toHaveCount(0);
});
