"use client";

import { useState } from "react";
import { BulkActions } from "./bulk-actions";
import { Input } from "@/components/ui/input";
import { useAdminSession } from "@/lib/admin-session";
import { customerBulkActions } from "@/lib/bulk-resource-actions";
import type { AdminCustomer } from "@/lib/customer-management";
import type { BulkSelection } from "@/lib/use-bulk-selection";

export function CustomerBulkActions({
  selection,
  total,
  disabled,
  loadAll,
  onComplete
}: {
  selection: BulkSelection<AdminCustomer>;
  total: number;
  disabled: boolean;
  loadAll: () => Promise<AdminCustomer[]>;
  onComplete: () => Promise<unknown>;
}) {
  const { api } = useAdminSession();
  const [note, setNote] = useState("");
  const actions = customerBulkActions(api, note).map((action) => ({
    ...action,
    fields: (
      <label>
        Account status note
        <Input
          maxLength={1000}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
    )
  }));
  return (
    <BulkActions
      selection={selection}
      actions={actions}
      total={total}
      disabled={disabled}
      loadAll={loadAll}
      getLabel={(customer) => `${customer.name} (${customer.mobileNumber})`}
      onComplete={onComplete}
    />
  );
}
