import {
  DeliveryPartnerDetailPage,
  DeliveryRoute
} from "../../_components/delivery-sections";

type DeliveryPartnerDetailRoutePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function DeliveryPartnerDetailRoutePage({
  params
}: DeliveryPartnerDetailRoutePageProps) {
  const { id } = await params;

  return (
    <DeliveryRoute>
      <DeliveryPartnerDetailPage partnerId={id} />
    </DeliveryRoute>
  );
}
