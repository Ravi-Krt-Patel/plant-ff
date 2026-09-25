import { z } from "zod";
import type { State } from "../contracts";
export const demoZones = [
  { pin: "221001", cod: true },
  { pin: "221005", cod: true },
  { pin: "221010", cod: false },
];
export function deliverySlots(state: Readonly<State>, now: number) {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now + 86400000));
  return [
    {
      id: `${date}:morning`,
      label: "10 am–1 pm",
      start: `${date}T10:00:00+05:30`,
    },
    {
      id: `${date}:evening`,
      label: "4 pm–7 pm",
      start: `${date}T16:00:00+05:30`,
    },
  ].map((slot) => ({
    ...slot,
    startAt: new Date(slot.start).toISOString(),
    capacity: 10,
    remaining: Math.max(
      0,
      10 -
        [...state.orders.values()].filter(
          (o) => o.slotId === slot.id && !o.resourcesReleased,
        ).length,
    ),
    demo: true,
  }));
}
export function serviceability(
  state: Readonly<State>,
  pinInput: unknown,
  now: number,
) {
  const pin = z
    .string()
    .regex(/^\d{6}$/)
    .parse(pinInput);
  const zone = demoZones.find((z) => z.pin === pin);
  return {
    pin,
    eligible: !!zone,
    codEligible: zone?.cod ?? false,
    shippingPaise: zone ? 4900 : null,
    currency: "INR",
    slots: zone ? deliverySlots(state, now) : [],
    demo: true,
    reason: zone
      ? "Configured demonstration zone only"
      : "Outside configured demo zones. PIN syntax alone does not establish serviceability.",
  };
}
