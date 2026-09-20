import { OrderView } from "@/features/orders/views";
import { orderIds } from "@/mocks/order-ids";
export function generateStaticParams() {
  return orderIds.map((orderId) => ({ orderId }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  return <OrderView id={(await params).orderId} />;
}
