import {
  DeliveryChargeCreatePage,
  DeliveryChargesRoute
} from "../_components/delivery-charge-sections";

export default function NewDeliveryChargeRulePage() {
  return (
    <DeliveryChargesRoute>
      <DeliveryChargeCreatePage />
    </DeliveryChargesRoute>
  );
}
