"use client";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiEnabled, apiRequest, errorMessage } from "./api";
import {
  deliveryAddressSchema,
  savedAddressSchema,
  type DeliveryAddress,
  type SavedAddress,
  type Session,
} from "./contracts";
import {
  AddressFields,
  AddressText,
  blankAddress,
  editableAddress,
} from "./address-fields";
import { SessionPanel } from "./session-panel";
import { useStore } from "@/features/cart/store";
function Editor({
  value,
  onSave,
  onCancel,
}: {
  value?: SavedAddress;
  onSave: (address: DeliveryAddress) => Promise<void>;
  onCancel: () => void;
}) {
  const form = useForm<DeliveryAddress>({
    resolver: zodResolver(deliveryAddressSchema),
    defaultValues: value ? editableAddress(value.value) : blankAddress,
  });
  const [error, setError] = useState("");
  return (
    <form
      className="panel delivery-editor"
      noValidate
      onSubmit={form.handleSubmit(async (value) => {
        setError("");
        try {
          await onSave(value);
        } catch (e) {
          setError(errorMessage(e));
        }
      })}
    >
      <h2>{value ? "Edit delivery address" : "Add delivery address"}</h2>
      <AddressFields form={form} disabled={form.formState.isSubmitting} />
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <div className="delivery-actions">
        <button
          className="button"
          type="submit"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Saving…" : "Save address"}
        </button>
        <button
          className="button secondary"
          type="button"
          onClick={onCancel}
          disabled={form.formState.isSubmitting}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
export function AddressBook() {
  const store = useStore();
  const [session, setSession] = useState<Session | null>(null),
    [rows, setRows] = useState<SavedAddress[]>([]),
    [editing, setEditing] = useState<SavedAddress | true | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const onSession = useCallback((s: Session | null) => {
    setSession(s);
    setEditing(null);
    if (!s?.userId) setRows([]);
  }, []);
  const load = useCallback(async () => {
    if (apiEnabled)
      setRows(await apiRequest("/addresses", z.array(savedAddressSchema)));
  }, []);
  useEffect(() => {
    if (!apiEnabled || !session?.userId) return;
    let active = true;
    apiRequest("/addresses", z.array(savedAddressSchema))
      .then((r) => {
        if (active) setRows(r);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [session]);
  const displayed = apiEnabled
    ? rows
    : store.addresses.map((value, i) => ({
        id: String(i),
        value,
        isDefault: i === 0,
      }));
  async function save(address: DeliveryAddress) {
    if (apiEnabled) {
      await apiRequest(
        editing !== true && editing
          ? "/addresses/" + encodeURIComponent(editing.id)
          : "/addresses",
        savedAddressSchema,
        {
          method: editing !== true && editing ? "PATCH" : "POST",
          body: address,
        },
      );
      await load();
    } else {
      store.setAddresses((old) =>
        editing !== true && editing
          ? old.map((x, i) => (String(i) === editing.id ? address : x))
          : [...old, address],
      );
    }
    setEditing(null);
  }
  async function action(row: SavedAddress, operation: "delete" | "default") {
    setBusy(true);
    setError("");
    try {
      if (apiEnabled) {
        await apiRequest(
          "/addresses/" +
            encodeURIComponent(row.id) +
            (operation === "default" ? "/default" : ""),
          z.unknown(),
          {
            method: operation === "default" ? "POST" : "DELETE",
            ...(operation === "default" ? { body: {} } : {}),
          },
        );
        await load();
      } else
        store.setAddresses((old) =>
          operation === "delete"
            ? old.filter((_, i) => String(i) !== row.id)
            : [
                old[Number(row.id)]!,
                ...old.filter((_, i) => String(i) !== row.id),
              ],
        );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="page-intro">
        {apiEnabled
          ? "Save a written address and an accurate pin for each doorstep."
          : "Demo addresses stay in this tab’s memory. Use fictional details; backend saving is not configured."}
      </p>
      {apiEnabled && <SessionPanel onChange={onSession} />}
      <div className="delivery-address-book">
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        {(!apiEnabled || session?.userId) && (
          <>
            <button
              className="button"
              type="button"
              onClick={() => setEditing(true)}
            >
              Add delivery address
            </button>
            {!displayed.length && (
              <p className="message">No saved addresses yet.</p>
            )}
            {displayed.map((row) => (
              <section className="panel delivery-address-card" key={row.id}>
                {row.isDefault && (
                  <span className="eyebrow">DEFAULT ADDRESS</span>
                )}
                <AddressText address={row.value} />
                {row.value.latitude == null || row.value.longitude == null ? (
                  <p>Delivery pin not saved. Edit this address to add one.</p>
                ) : (
                  <p className="delivery-coordinate">
                    {row.value.latitude.toFixed(6)},{" "}
                    {row.value.longitude.toFixed(6)}
                  </p>
                )}
                <div className="delivery-actions">
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy}
                    onClick={() => setEditing(row)}
                  >
                    Edit address
                  </button>
                  {!row.isDefault && (
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy}
                      onClick={() => action(row, "default")}
                    >
                      Set as default
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy}
                    onClick={() => action(row, "delete")}
                  >
                    Remove address
                  </button>
                </div>
              </section>
            ))}
          </>
        )}
        {editing && (
          <Editor
            key={editing === true ? "new" : editing.id}
            value={editing === true ? undefined : editing}
            onSave={save}
            onCancel={() => setEditing(null)}
          />
        )}
      </div>
    </>
  );
}
