"use client";
import Image from "next/image";
import { Modal } from "@/components/ui/modal";
export default function Zoom({
  src,
  name,
  onClose,
}: {
  src: string;
  name: string;
  onClose: () => void;
}) {
  return (
    <Modal title={name} onClose={onClose}>
      <div className="zoom-image">
        <Image src={src} alt={name} fill sizes="90vw" />
      </div>
    </Modal>
  );
}
