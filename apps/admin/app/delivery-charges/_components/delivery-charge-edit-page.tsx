"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { EmptyState } from "@/components/admin/empty-state";
import { LoadingState } from "@/components/admin/loading-state";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { useAdminSession } from "../../../lib/admin-session";
import {
  buildDeliveryChargePayload,
  deliveryChargeRuleToFormValues,
  validateDeliveryChargeForm,
  type AdminDeliveryChargeRule,
  type DeliveryChargeFieldErrors,
  type DeliveryChargeFormValues,
  type DeliveryChargePayload,
  type PaginatedDeliveryChargeResponse
} from "../../../lib/delivery-charge-management";
import { notify } from "../../../lib/notifications";
import { ADMIN_PERMISSION } from "../../../lib/permissions";
import type { WarehouseListResponse } from "../../../lib/warehouse-management";
import {
  DeliveryChargeForm,
  DeliveryChargeSectionNav,
  type DeliveryChargeWarehouse
} from "./delivery-charge-sections";

export function DeliveryChargeEditPage({ ruleId }: { ruleId: string }) {
  const { api, hasPermission } = useAdminSession();
  const canReadWarehouses = hasPermission(ADMIN_PERMISSION.WarehouseRead);
  const ruleQuery = useQuery({
    queryFn: async ({ signal }) => {
      let page = 1;
      let hasNextPage = true;

      while (hasNextPage) {
        const result = await api.request<PaginatedDeliveryChargeResponse>(
          "/admin/delivery-charge-rules",
          { query: { limit: 100, page }, signal }
        );
        const rule = result.items.find((item) => item.id === ruleId);
        if (rule) return rule;
        hasNextPage = result.pagination.hasNextPage;
        page += 1;
      }

      return null;
    },
    queryKey: ["admin", "delivery-charge-rules", "detail", ruleId],
    refetchOnWindowFocus: false,
    retry: false
  });
  const warehousesQuery = useQuery({
    enabled: canReadWarehouses,
    queryFn: ({ signal }) =>
      api.request<WarehouseListResponse>("/admin/warehouses", {
        query: { limit: 100, status: "ACTIVE" },
        signal
      }),
    queryKey: ["admin", "warehouses", "active"],
    retry: false
  });
  const warehouses = useMemo(() => {
    const options = new Map<string, DeliveryChargeWarehouse>();
    for (const warehouse of [
      ...(warehousesQuery.data?.items ?? []),
      ...(ruleQuery.data?.warehouse ? [ruleQuery.data.warehouse] : [])
    ]) {
      options.set(warehouse.id, warehouse);
    }
    return [...options.values()];
  }, [ruleQuery.data?.warehouse, warehousesQuery.data?.items]);

  return (
    <>
      <section className="panel deliveryChargeOverviewPanel">
        <DeliveryChargeSectionNav active="rules" />
        <PageHeader
          actions={
            <Button asChild className="iconTextButton" variant="outline">
              <Link href="/delivery-charges/rules">
                <ArrowLeft aria-hidden size={16} />
                <span>Back to rules</span>
              </Link>
            </Button>
          }
          className="deliveryChargePageHeader"
          eyebrow="Delivery charges"
          title="Edit delivery charge rule"
        />
      </section>

      <section className="panel deliveryChargeFormPanel deliveryChargeFormOnlyPanel mt-3">
        {ruleQuery.isPending ? <LoadingState label="Loading delivery charge rule..." /> : null}
        {ruleQuery.isError ? (
          <>
            <p className="formError" role="alert">
              {getErrorMessage(ruleQuery.error) ?? "Unable to load the delivery charge rule."}
            </p>
            <Button onClick={() => void ruleQuery.refetch()} variant="outline">
              Try again
            </Button>
          </>
        ) : null}
        {ruleQuery.isSuccess && !ruleQuery.data ? (
          <EmptyState
            body="This delivery charge rule could not be found. It may have been archived."
            title="Delivery charge rule unavailable"
          />
        ) : null}
        {ruleQuery.isSuccess && ruleQuery.data ? (
          <DeliveryChargeEditor
            key={ruleId}
            rule={ruleQuery.data}
            warehouseError={getErrorMessage(warehousesQuery.error)}
            warehouses={warehouses}
          />
        ) : null}
      </section>
    </>
  );
}

function DeliveryChargeEditor({
  rule,
  warehouseError,
  warehouses
}: {
  rule: AdminDeliveryChargeRule;
  warehouseError: string | null;
  warehouses: DeliveryChargeWarehouse[];
}) {
  const { api } = useAdminSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [values, setValues] = useState<DeliveryChargeFormValues>(() =>
    deliveryChargeRuleToFormValues(rule)
  );
  const [errors, setErrors] = useState<DeliveryChargeFieldErrors>({});
  const updateMutation = useMutation({
    mutationFn: (payload: DeliveryChargePayload) =>
      api.request<AdminDeliveryChargeRule>(
        `/admin/delivery-charge-rules/${encodeURIComponent(rule.id)}`,
        { body: JSON.stringify(payload), method: "PATCH" }
      )
  });

  function updateValue<TKey extends keyof DeliveryChargeFormValues>(
    key: TKey,
    value: DeliveryChargeFormValues[TKey]
  ) {
    if (updateMutation.isPending) return;
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function saveRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (updateMutation.isPending) return;

    const fieldErrors = validateDeliveryChargeForm(values);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return;

    try {
      const savedRule = await updateMutation.mutateAsync(
        buildDeliveryChargePayload(values)
      );
      queryClient.setQueryData(
        ["admin", "delivery-charge-rules", "detail", rule.id],
        savedRule
      );
      await queryClient.invalidateQueries({
        queryKey: ["admin", "delivery-charge-rules"],
        refetchType: "none"
      });
      notify.success("Delivery charge rule updated.");
      router.push("/delivery-charges/rules");
    } catch {
      // Keep the draft available for correction or retry after a failed save.
    }
  }

  return (
    <>
      {warehouseError ? (
        <p className="formError" role="alert">
          {warehouseError}
        </p>
      ) : null}
      {updateMutation.error ? (
        <p className="formError" role="alert">
          {getErrorMessage(updateMutation.error) ?? "Unable to update the delivery charge rule."}
        </p>
      ) : null}
      <DeliveryChargeForm
        errors={errors}
        isEditing
        isSaving={updateMutation.isPending}
        onCancel={() => router.push("/delivery-charges/rules")}
        onChange={updateValue}
        onSubmit={saveRule}
        values={values}
        warehouses={warehouses}
      />
    </>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}
