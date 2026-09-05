import { DeliveryChargeEditPage } from "../../_components/delivery-charge-edit-page";
import { DeliveryChargesRoute } from "../../_components/delivery-charge-sections";

export default async function EditDeliveryChargeRuleRoutePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <DeliveryChargesRoute>
      <DeliveryChargeEditPage key={id} ruleId={id} />
    </DeliveryChargesRoute>
  );
}
