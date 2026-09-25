"use client";
import type { UseFormReturn } from "react-hook-form";
import type { DeliveryAddress, LegacyDeliveryAddress } from "./contracts";
import { LocationPicker } from "./location-picker";
export const blankAddress = {
  name: "",
  phone: "",
  line: "",
  locality: "",
  city: "Varanasi",
  state: "Uttar Pradesh",
  pin: "",
  landmark: "",
  instructions: "",
};
export function editableAddress(value: LegacyDeliveryAddress) {
  return {
    ...blankAddress,
    ...value,
    landmark: value.landmark ?? "",
    instructions: value.instructions ?? "",
    latitude: value.latitude ?? undefined,
    longitude: value.longitude ?? undefined,
  };
}
export function AddressFields({
  form,
  disabled = false,
}: {
  form: UseFormReturn<DeliveryAddress>;
  disabled?: boolean;
}) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form;
  const latitude = watch("latitude"),
    longitude = watch("longitude");
  const fields = [
    ["name", "Full name", "name"],
    ["phone", "Mobile number", "tel"],
    ["line", "Address", "street-address"],
    ["locality", "Locality", "address-line2"],
    ["city", "City", "address-level2"],
    ["state", "State", "address-level1"],
    ["pin", "PIN code", "postal-code"],
    ["landmark", "Landmark (optional)", "off"],
    ["instructions", "Delivery instructions (optional)", "off"],
  ] as const;
  return (
    <>
      <div className="form-grid">
        {fields.map(([key, label, autocomplete]) => (
          <label
            key={key}
            className={key === "line" || key === "instructions" ? "span-2" : ""}
          >
            {label}
            <input
              {...register(key)}
              autoComplete={autocomplete}
              disabled={disabled}
              inputMode={key === "phone" || key === "pin" ? "numeric" : "text"}
              maxLength={key === "phone" ? 10 : key === "pin" ? 6 : undefined}
              aria-invalid={!!errors[key]}
              aria-describedby={
                errors[key] ? "address-error-" + key : undefined
              }
            />
            {errors[key] && (
              <span
                id={"address-error-" + key}
                role="alert"
                className="error-text"
              >
                {errors[key]?.message}
              </span>
            )}
          </label>
        ))}
      </div>
      <div className="delivery-pin-field">
        <h3>Delivery pin</h3>
        <p>
          Place the pin at your entrance, then check the written address above.
          Your pin does not replace the address.
        </p>
        <LocationPicker
          value={
            Number.isFinite(latitude) && Number.isFinite(longitude)
              ? { latitude, longitude }
              : null
          }
          disabled={disabled}
          onChange={(point) => {
            setValue("latitude", point.latitude, {
              shouldDirty: true,
              shouldValidate: true,
            });
            setValue("longitude", point.longitude, {
              shouldDirty: true,
              shouldValidate: true,
            });
          }}
        />
        {(errors.latitude || errors.longitude) && (
          <p role="alert" className="error-text">
            {errors.latitude?.message ?? errors.longitude?.message}
          </p>
        )}
      </div>
    </>
  );
}
export function AddressText({ address }: { address: LegacyDeliveryAddress }) {
  return (
    <address className="delivery-address-text">
      <strong>{address.name}</strong>
      <br />
      {address.line}, {address.locality}
      <br />
      {[address.city, address.state].filter(Boolean).join(", ")} {address.pin}
      <br />
      {address.phone}
      {address.landmark && (
        <>
          <br />
          Landmark: {address.landmark}
        </>
      )}
      {address.instructions && (
        <>
          <br />
          {address.instructions}
        </>
      )}
    </address>
  );
}
