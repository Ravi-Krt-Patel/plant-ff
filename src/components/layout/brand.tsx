import { Leaf } from "lucide-react";
export function Brand() {
  return (
    <span className="brand">
      <Leaf size={33} strokeWidth={1.6} />
      <span>
        kashi<span className="brand-light">greens</span>
        <small>A LITTLE GREEN. A LOT OF JOY.</small>
      </span>
    </span>
  );
}
