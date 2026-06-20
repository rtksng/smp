import {
  DeliveryChargesLandingPage,
  DeliveryChargesRoute
} from "./_components/delivery-charge-sections";

export default function DeliveryChargesPage() {
  return (
    <DeliveryChargesRoute>
      <DeliveryChargesLandingPage />
    </DeliveryChargesRoute>
  );
}
