"use client";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { paymentService } from "@/mocks/services";
import type { PaymentStatus } from "@/contracts";
export default function Payment({
  orderId,
  method,
  onResult,
  onClose,
}: {
  orderId: string;
  method: string;
  onResult: (s: PaymentStatus) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const settle = async (s: PaymentStatus) => {
    setBusy(true);
    const r = await paymentService.confirm(orderId, s);
    if (r.ok) onResult(r.data);
    setBusy(false);
  };
  return (
    <Modal
      title="A practice payment, only."
      description="Demo payment — no money will be charged."
      onClose={onClose}
    >
      <p>
        You selected {method.toUpperCase()}. Choose a simulated outcome below.
        No card numbers, UPI PINs, or bank details are needed.
      </p>
      <div className="message">Demo order · {orderId}</div>
      <div className="modal-buttons">
        <button
          className="button"
          disabled={busy}
          onClick={() => settle("success")}
        >
          Simulate success
        </button>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => settle("pending")}
        >
          Simulate pending
        </button>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => settle("failure")}
        >
          Simulate failure
        </button>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => settle("dismissed")}
        >
          Dismiss payment
        </button>
      </div>
      {busy && <p role="status">Simulating confirmation…</p>}
    </Modal>
  );
}
