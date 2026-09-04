"use client";

import { useQuery } from "@tanstack/react-query";
import { listAvailableCoupons } from "../../lib/api/coupons";
import { customerQueryKeys } from "../../lib/api/query-keys";
import { Button } from "../ui/button";

const money = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 2,
  style: "currency"
});
const expiryDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric"
});

export function AvailableCoupons({
  appliedCode,
  disabled,
  onApply,
  subtotal
}: {
  appliedCode: string | null;
  disabled: boolean;
  onApply: (code: string) => void;
  subtotal: number;
}) {
  const couponsQuery = useQuery({
    queryFn: listAvailableCoupons,
    queryKey: customerQueryKeys.availableCoupons(),
    retry: false,
    staleTime: 0
  });

  if (couponsQuery.isPending) {
    return <p className="mt-3 text-sm text-[#55716e]" role="status">Loading promo codes...</p>;
  }

  if (couponsQuery.isError) {
    return (
      <div className="mt-3 text-sm text-[#55716e]">
        <p>Available promo codes could not be loaded. You can still enter a code above.</p>
        <button
          className="mt-1 font-semibold text-[#0f6f68] underline underline-offset-2 disabled:opacity-50"
          disabled={couponsQuery.isFetching}
          onClick={() => void couponsQuery.refetch()}
          type="button"
        >
          {couponsQuery.isFetching ? "Loading..." : "Retry promo codes"}
        </button>
      </div>
    );
  }

  if (couponsQuery.data.items.length === 0) {
    return null;
  }

  return (
    <section aria-label="Available promo codes" className="mt-4 border-t border-[#c4e4e0] pt-4">
      <h3 className="text-sm font-semibold text-[#123f3c]">Available promo codes</h3>
      <ul className="mt-3 grid max-h-80 gap-2 overflow-y-auto pr-1">
        {couponsQuery.data.items.map((coupon) => {
          const remaining = Math.max(0, (coupon.minOrderAmount ?? 0) - subtotal);
          const isApplied = appliedCode?.toUpperCase() === coupon.code.toUpperCase();

          return (
            <li className="rounded-lg border border-[#c4e4e0] bg-[#f7fcfb] p-3" key={coupon.code}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0f6f68]">
                    {coupon.type === "PERCENTAGE" ? `${coupon.value}% off` : `${money.format(coupon.value)} off`}
                  </p>
                  <p className="mt-1 break-all font-mono text-xs font-semibold text-[#123f3c]">{coupon.code}</p>
                </div>
                <Button
                  aria-label={isApplied ? `${coupon.code} applied` : `Apply ${coupon.code}`}
                  disabled={disabled || isApplied || remaining > 0}
                  onClick={() => onApply(coupon.code)}
                  type="button"
                  variant="outline"
                >
                  {isApplied ? "Applied" : "Apply"}
                </Button>
              </div>
              <div className="mt-2 space-y-1 text-xs leading-5 text-[#55716e]">
                {coupon.minOrderAmount !== null ? <p>Minimum order {money.format(coupon.minOrderAmount)}</p> : null}
                {coupon.maxDiscount !== null ? <p>Save up to {money.format(coupon.maxDiscount)}</p> : null}
                {coupon.expiresAt ? <p>Expires {expiryDate.format(new Date(coupon.expiresAt))}</p> : null}
                {remaining > 0 ? <p>Add {money.format(remaining)} more to use this code.</p> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
