import type { Metadata } from "next";
import { OrderSuccessPage } from "../../../components/checkout/order-success-page";
import { buildPrivateMetadata } from "../../../lib/seo/metadata";

type OrderSuccessRouteProps = {
  params: Promise<{
    orderId: string;
  }>;
};

export async function generateMetadata({
  params
}: OrderSuccessRouteProps): Promise<Metadata> {
  const { orderId } = await params;

  return buildPrivateMetadata({
    description:
      "View protected order confirmation, payment status, delivery address, and totals.",
    path: `/order-success/${orderId}`,
    title: "Order Confirmation"
  });
}

export default async function OrderSuccessRoute({
  params
}: OrderSuccessRouteProps) {
  const { orderId } = await params;

  return <OrderSuccessPage orderId={orderId} />;
}
