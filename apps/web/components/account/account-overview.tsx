"use client";

import { useCustomerAuthStore } from "../../lib/stores/auth-store";
import { Button } from "../ui/button";
import {
  AccountInfoGrid,
  CustomerAccountShell,
  PrivateEmptyState
} from "./customer-account-shell";

export function AccountOverview() {
  const customer = useCustomerAuthStore((state) => state.session?.customer);

  return (
    <CustomerAccountShell
      activePath="/account"
      description="Manage your profile, addresses, and orders for medical equipment purchases."
      title="Account overview"
    >
      <AccountInfoGrid
        items={[
          { label: "Mobile number", value: customer?.mobileNumber ?? "-" },
          { label: "Name", value: customer?.firstName ?? "Customer" },
          { label: "Email", value: customer?.email ?? "Not added" },
          { label: "Account status", value: "Active" }
        ]}
      />
      <PrivateEmptyState
        action={<Button href="/products">Browse products</Button>}
        description="Your recent orders and saved buying details will appear here as you place orders."
        title="Ready for your first order"
      />
    </CustomerAccountShell>
  );
}
