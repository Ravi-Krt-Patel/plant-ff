import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { z } from "zod";
import { AddressBook } from "@/features/delivery/address-book";
import type { Coordinates } from "@/features/delivery/location-map";
import type { RequestOptions } from "@/features/delivery/api";
import type {
  DeliveryAddress,
  SavedAddress,
} from "@/features/delivery/contracts";

const mocks = vi.hoisted(() => ({ request: vi.fn(), localSave: vi.fn() }));
vi.mock("@/features/delivery/api", () => ({
  apiEnabled: true,
  apiRequest: (...args: unknown[]) => mocks.request(...args),
  errorMessage: (error: unknown) =>
    error instanceof Error ? error.message : "Request failed",
}));
vi.mock("@/features/cart/store", () => ({
  useStore: () => ({ addresses: [], setAddresses: mocks.localSave }),
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
const address: DeliveryAddress = {
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
const session = {
  sessionId: "session-one",
  userId: "user-one",
  role: "customer",
  verifiedAt: "2026-09-23T08:00:00.000Z",
};
let rows: SavedAddress[];
let handle: (
  path: string,
  options: RequestOptions,
) => unknown | Promise<unknown>;
function response(path: string, options: RequestOptions) {
  if (path === "/auth/session") return session;
  if (path === "/auth/logout") return { signedOut: true };
  if (path === "/addresses" && !options.method) return rows;
  if (path === "/addresses" && options.method === "POST") {
    const saved = {
      id: "address-new",
      isDefault: false,
      value: options.body as DeliveryAddress,
    };
    rows = [...rows, saved];
    return saved;
  }
  if (path === "/addresses/address-one" && options.method === "PATCH") {
    const saved = { ...rows[0]!, value: options.body as DeliveryAddress };
    rows = [saved, ...rows.slice(1)];
    return saved;
  }
  if (path === "/addresses/address-two/default" && options.method === "POST") {
    rows = rows.map((row) => ({ ...row, isDefault: row.id === "address-two" }));
    return rows[1];
  }
  if (path === "/addresses/address-two" && options.method === "DELETE") {
    rows = rows.filter((row) => row.id !== "address-two");
    return { deleted: true };
  }
  throw new Error(`Unexpected request: ${path} ${options.method ?? "GET"}`);
}
beforeEach(() => {
  vi.clearAllMocks();
  rows = [
    { id: "address-one", isDefault: true, value: { ...address } },
    {
      id: "address-two",
      isDefault: false,
      value: { ...address, name: "Other Recipient", line: "25 Grove Road" },
    },
  ];
  handle = response;
  mocks.request.mockImplementation(
    async (path: string, schema: z.ZodType, options: RequestOptions = {}) =>
      schema.parse(await handle(path, options)),
  );
});
afterEach(cleanup);
function calls(path: string, method: string) {
  return mocks.request.mock.calls.filter(
    (call) => call[0] === path && (call[2]?.method ?? "GET") === method,
  );
}
async function loadedBook() {
  render(<AddressBook />);
  await screen.findByText("Demo Recipient");
}
function card(name: string) {
  const section = screen.getByText(name).closest("section");
  if (!section) throw new Error("Address card missing");
  return within(section);
}
function fillNewAddress() {
  for (const [label, value] of [
    ["Full name", "New Recipient"],
    ["Mobile number", "9123456780"],
    ["Address", "8 Tulsi Lane"],
    ["Locality", "Assi"],
    ["City", "Varanasi"],
    ["State", "Uttar Pradesh"],
    ["PIN code", "221005"],
  ]) {
    fireEvent.change(screen.getByLabelText(label!), { target: { value } });
  }
  fireEvent.click(screen.getByRole("button", { name: "Adjust delivery pin" }));
}

describe("saved delivery address book", () => {
  it("adds a written address and coordinates through the authenticated address collection", async () => {
    await loadedBook();
    fireEvent.click(
      screen.getByRole("button", { name: "Add delivery address" }),
    );
    fillNewAddress();
    fireEvent.click(screen.getByRole("button", { name: "Save address" }));
    await screen.findByText("New Recipient");
    expect(calls("/addresses", "POST")[0]?.[2].body).toEqual({
      name: "New Recipient",
      phone: "9123456780",
      line: "8 Tulsi Lane",
      locality: "Assi",
      city: "Varanasi",
      state: "Uttar Pradesh",
      pin: "221005",
      landmark: "",
      instructions: "",
      latitude: 25.3085,
      longitude: 83.0075,
    });
    expect(screen.queryByRole("button", { name: "Save address" })).toBeNull();
    expect(mocks.localSave).not.toHaveBeenCalled();
  });

  it("edits a specific address and persists the corrected pin with its written details", async () => {
    await loadedBook();
    fireEvent.click(
      card("Demo Recipient").getByRole("button", { name: "Edit address" }),
    );
    expect((screen.getByLabelText("Address") as HTMLInputElement).value).toBe(
      "12 Garden Lane",
    );
    fireEvent.change(screen.getByLabelText("Address"), {
      target: { value: "14 Garden Lane, east entrance" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Adjust delivery pin" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save address" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Save address" })).toBeNull(),
    );
    expect(calls("/addresses/address-one", "PATCH")[0]?.[2].body).toEqual({
      ...address,
      line: "14 Garden Lane, east entrance",
      latitude: 25.3085,
      longitude: 83.0075,
    });
    expect(calls("/addresses", "POST")).toHaveLength(0);
    expect(screen.getByText(/14 Garden Lane, east entrance/)).toBeTruthy();
  });

  it("sets default and removes an address through individual ownership-scoped routes", async () => {
    await loadedBook();
    fireEvent.click(
      card("Other Recipient").getByRole("button", { name: "Set as default" }),
    );
    await waitFor(() =>
      expect(card("Other Recipient").getByText("DEFAULT ADDRESS")).toBeTruthy(),
    );
    expect(calls("/addresses/address-two/default", "POST")[0]?.[2]).toEqual({
      method: "POST",
      body: {},
    });
    expect(card("Demo Recipient").queryByText("DEFAULT ADDRESS")).toBeNull();
    fireEvent.click(
      card("Other Recipient").getByRole("button", { name: "Remove address" }),
    );
    await waitFor(() =>
      expect(screen.queryByText("Other Recipient")).toBeNull(),
    );
    expect(calls("/addresses/address-two", "DELETE")).toHaveLength(1);
    expect(screen.getByText("Demo Recipient")).toBeTruthy();
    expect(mocks.localSave).not.toHaveBeenCalled();
  });

  it("requires a complete address and pin before sending save requests", async () => {
    await loadedBook();
    fireEvent.click(
      screen.getByRole("button", { name: "Add delivery address" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save address" }));
    await waitFor(() =>
      expect(
        screen
          .getAllByRole("alert")
          .some((node) =>
            node.textContent?.includes("Choose your delivery pin"),
          ),
      ).toBe(true),
    );
    expect(calls("/addresses", "POST")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Save address" })).toBeTruthy();
  });

  it("preserves the editor and does not fall back to local data when saving fails", async () => {
    handle = (path, options) => {
      if (path === "/addresses/address-one" && options.method === "PATCH")
        throw new Error("Address update denied");
      return response(path, options);
    };
    await loadedBook();
    fireEvent.click(
      card("Demo Recipient").getByRole("button", { name: "Edit address" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Adjust delivery pin" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save address" }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Address update denied",
    );
    expect(screen.getByTestId("delivery-pin").textContent).toBe(
      "25.3085,83.0075",
    );
    expect(
      screen
        .getByRole("button", { name: "Save address" })
        .getAttribute("disabled"),
    ).toBeNull();
    expect(mocks.localSave).not.toHaveBeenCalled();
  });

  it("keeps the visible address when deletion is rejected", async () => {
    handle = (path, options) => {
      if (options.method === "DELETE") throw new Error("Address unavailable");
      return response(path, options);
    };
    await loadedBook();
    fireEvent.click(
      card("Other Recipient").getByRole("button", { name: "Remove address" }),
    );
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Address unavailable",
    );
    expect(screen.getByText("Other Recipient")).toBeTruthy();
    expect(mocks.localSave).not.toHaveBeenCalled();
  });

  it("does not request or display an address book for guests", async () => {
    handle = (path, options) =>
      path === "/auth/session"
        ? { ...session, userId: null, verifiedAt: null, role: "guest" }
        : response(path, options);
    render(<AddressBook />);
    await screen.findByRole("button", { name: "Get verification code" });
    expect(calls("/addresses", "GET")).toHaveLength(0);
    expect(
      screen.queryByRole("button", { name: "Add delivery address" }),
    ).toBeNull();
    expect(screen.queryByText("Demo Recipient")).toBeNull();
  });

  it("hides saved addresses on sign-out and ignores a late address response", async () => {
    let resolveAddresses: ((value: SavedAddress[]) => void) | undefined;
    handle = (path, options) =>
      path === "/addresses"
        ? new Promise<SavedAddress[]>((resolve) => {
            resolveAddresses = resolve;
          })
        : response(path, options);
    render(<AddressBook />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    await screen.findByRole("button", { name: "Get verification code" });
    await act(async () => resolveAddresses?.(rows));
    expect(screen.queryByText("Demo Recipient")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Add delivery address" }),
    ).toBeNull();
  });
});
