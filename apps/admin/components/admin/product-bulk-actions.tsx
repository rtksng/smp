"use client";

import { useState } from "react";
import { BulkActions } from "./bulk-actions";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useAdminSession } from "@/lib/admin-session";
import { productBulkActions, type ProductBulkValues } from "@/lib/bulk-module-actions";
import type { AdminBrand, AdminCategory, AdminProduct } from "@/lib/product-form";
import type { BulkSelection } from "@/lib/use-bulk-selection";

export function BulkSelectField({
  label,
  value,
  onChange,
  options,
  placeholder = "Choose an option"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; name: string }[];
  placeholder?: string;
}) {
  return (
    <label className="bulkSelectField">
      <span>{label}</span>
      <Select aria-label={label} value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">{placeholder}</SelectItem>
          {options.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

export function ProductBulkActions({
  selection,
  brands,
  categories,
  total,
  loadAll,
  onComplete,
  disabled
}: {
  selection: BulkSelection<AdminProduct>;
  brands: AdminBrand[];
  categories: AdminCategory[];
  total: number;
  loadAll: () => Promise<AdminProduct[]>;
  onComplete: () => Promise<unknown>;
  disabled: boolean;
}) {
  const { api } = useAdminSession();
  const [values, setValues] = useState<ProductBulkValues>({
    brandId: "",
    categoryId: "",
    subcategoryId: "",
    taxRate: ""
  });
  const activeBrands = brands.filter((brand) => brand.isActive);
  const roots = categories.filter(
    (category) => category.isActive && !category.parentId
  );
  const category = roots.find((item) => item.id === values.categoryId);
  const children = category?.children.filter((item) => item.isActive) ?? [];
  const actions = productBulkActions(
    api,
    values,
    {
      brand: activeBrands.find((item) => item.id === values.brandId)?.name ?? "",
      category: category?.name ?? "",
      subcategory: children.find((item) => item.id === values.subcategoryId)?.name ?? ""
    },
    children.length > 0
  ).map((action) => ({
    ...action,
    fields:
      action.id === "brand" ? (
        <BulkSelectField
          label="New brand"
          value={values.brandId}
          options={activeBrands}
          onChange={(brandId) => setValues({ ...values, brandId })}
        />
      ) : action.id === "category" ? (
        <>
          <BulkSelectField
            label="New category"
            value={values.categoryId}
            options={roots}
            onChange={(categoryId) =>
              setValues({ ...values, categoryId, subcategoryId: "" })
            }
          />
          {children.length ? (
            <BulkSelectField
              label="New subcategory"
              value={values.subcategoryId}
              options={children}
              onChange={(subcategoryId) => setValues({ ...values, subcategoryId })}
            />
          ) : null}
        </>
      ) : action.id === "tax" ? (
        <label>
          New tax rate (%)
          <Input
            inputMode="decimal"
            value={values.taxRate}
            onChange={(event) => setValues({ ...values, taxRate: event.target.value })}
          />
        </label>
      ) : undefined
  }));
  return (
    <BulkActions
      selection={selection}
      actions={actions}
      total={total}
      loadAll={loadAll}
      getLabel={(item) => `${item.name} (${item.sku})`}
      onComplete={onComplete}
      disabled={disabled}
    />
  );
}
