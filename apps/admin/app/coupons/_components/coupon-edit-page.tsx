"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { EmptyState } from "@/components/admin/empty-state";
import { LoadingState } from "@/components/admin/loading-state";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { useAdminSession } from "../../../lib/admin-session";
import { notify } from "../../../lib/notifications";
import {
  buildCouponPayload,
  couponToFormValues,
  validateCouponForm,
  type AdminCoupon,
  type CouponFieldErrors,
  type CouponFormValues,
  type CouponPayload,
  type PaginatedAdminResponse
} from "../../../lib/support-management";
import { CouponForm, CouponSectionNav } from "./coupon-sections";

export function CouponEditPage({ couponId }: { couponId: string }) {
  const { api } = useAdminSession();
  const couponQuery = useQuery({
    queryKey: ["admin", "coupons", "detail", couponId],
    queryFn: async ({ signal }) => {
      // The deployed coupon API exposes a paginated list, not a detail endpoint.
      let page = 1;
      let hasNextPage = true;
      while (hasNextPage) {
        const result = await api.request<PaginatedAdminResponse<AdminCoupon>>(
          "/admin/coupons",
          { query: { page, limit: 100 }, signal }
        );
        const coupon = result.items.find((item) => item.id === couponId);
        if (coupon) return coupon;
        hasNextPage = result.pagination.hasNextPage;
        page += 1;
      }
      return null;
    },
    refetchOnWindowFocus: false,
    retry: false
  });

  return (
    <div className="couponModule couponEditModule" data-coupon-view="edit">
      <section className="panel couponOverviewPanel">
        <CouponSectionNav active="coupons" />
        <PageHeader
          actions={
            <Button asChild className="iconTextButton" variant="outline">
              <Link href="/coupons/list">
                <ArrowLeft aria-hidden size={16} />
                <span>Back to coupons</span>
              </Link>
            </Button>
          }
          className="couponPageHeader couponEditPageHeader"
          eyebrow="Coupons"
          title="Edit coupon"
        />
      </section>
      <section className="panel couponFormPanel couponFormOnlyPanel couponEditFormPanel mt-3">
        {!couponQuery.isFetchedAfterMount ? <LoadingState label="Loading coupon..." /> : null}
        {couponQuery.isError ? (
          <>
            <p className="formError" role="alert">{couponQuery.error.message}</p>
            <Button onClick={() => void couponQuery.refetch()} variant="outline">Try again</Button>
          </>
        ) : null}
        {couponQuery.isFetchedAfterMount && couponQuery.isSuccess && !couponQuery.data ? (
          <EmptyState title="Coupon unavailable" body="This coupon could not be found. It may have been archived." />
        ) : null}
        {couponQuery.isFetchedAfterMount && couponQuery.isSuccess && couponQuery.data ? (
          <CouponEditor key={couponId} coupon={couponQuery.data} />
        ) : null}
      </section>
    </div>
  );
}

function CouponEditor({ coupon }: { coupon: AdminCoupon }) {
  const { api } = useAdminSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [originalValues] = useState(() => couponToFormValues(coupon));
  const [values, setValues] = useState(originalValues);
  const [errors, setErrors] = useState<CouponFieldErrors>({});
  const updateMutation = useMutation({
    mutationFn: (payload: Partial<CouponPayload>) =>
      api.request<AdminCoupon>(`/admin/coupons/${encodeURIComponent(coupon.id)}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      })
  });

  function updateValue<TKey extends keyof CouponFormValues>(key: TKey, value: CouponFormValues[TKey]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function saveCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (updateMutation.isPending) return;
    const fieldErrors = validateCouponForm(values);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return;

    const payload = buildCouponPayload(values);
    // Omit untouched fields so date inputs cannot truncate saved timestamps.
    const changes = Object.fromEntries(
      Object.entries(payload).filter(([key]) => values[key as keyof CouponFormValues] !== originalValues[key as keyof CouponFormValues])
    ) as Partial<CouponPayload>;

    try {
      if (Object.keys(changes).length) {
        const savedCoupon = await updateMutation.mutateAsync(changes);
        queryClient.setQueryData(["admin", "coupons", "detail", coupon.id], savedCoupon);
        await queryClient.invalidateQueries({ queryKey: ["admin", "coupons"], refetchType: "none" });
        notify.success("Coupon updated.");
      }
      router.push("/coupons/list");
    } catch {
      // Keep the draft available for correction or retry after a failed save.
    }
  }

  return (
    <>
      {updateMutation.error ? <p className="formError" role="alert">{updateMutation.error.message}</p> : null}
      <CouponForm
        errors={errors}
        isEditing
        isSaving={updateMutation.isPending}
        onCancel={() => router.push("/coupons/list")}
        onChange={updateValue}
        onSubmit={saveCoupon}
        values={values}
      />
    </>
  );
}
