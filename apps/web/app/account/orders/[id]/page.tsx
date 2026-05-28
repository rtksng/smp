import type { Metadata } from "next";
import { AccountOrderDetail } from "../../../../components/account/account-orders";
import { buildPrivateMetadata } from "../../../../lib/seo/metadata";

type AccountOrderDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function generateMetadata({
  params
}: AccountOrderDetailPageProps): Promise<Metadata> {
  const { id } = await params;

  return buildPrivateMetadata({
    description:
      "View protected customer order details, status, delivery address, and invoice actions.",
    path: `/account/orders/${id}`,
    title: "Order Details"
  });
}

export default async function AccountOrderDetailPage({
  params
}: AccountOrderDetailPageProps) {
  const { id } = await params;

  return <AccountOrderDetail orderId={id} />;
}
