import { CouponEditPage } from "../../_components/coupon-edit-page";
import { CouponsRoute } from "../../_components/coupon-sections";

export default async function EditCouponRoutePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <CouponsRoute>
      <CouponEditPage key={id} couponId={id} />
    </CouponsRoute>
  );
}
