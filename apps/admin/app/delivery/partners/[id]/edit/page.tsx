import { DeliveryPartnerEditPage } from "../../../_components/delivery-partner-form";
import { DeliveryRoute } from "../../../_components/delivery-sections";

type DeliveryPartnerEditRoutePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function DeliveryPartnerEditRoutePage({
  params
}: DeliveryPartnerEditRoutePageProps) {
  const { id } = await params;

  return (
    <DeliveryRoute>
      <DeliveryPartnerEditPage key={id} partnerId={id} />
    </DeliveryRoute>
  );
}
