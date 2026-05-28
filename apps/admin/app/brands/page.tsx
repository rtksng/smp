"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ImageUp,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X
} from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { AdminShell } from "../admin-shell";
import {
  ConfirmationDialog,
  type ConfirmationState
} from "../_components/confirmation-dialog";
import { ProtectedRoute, useAdminSession } from "../../lib/admin-session";
import { ADMIN_PERMISSION } from "../../lib/permissions";
import {
  brandFormSchema,
  brandToFormValues,
  buildBrandPayload,
  createEmptyBrandFormValues,
  formatCatalogStatus,
  slugifyCatalogName,
  type AdminBrand,
  type BrandFormValues
} from "../../lib/catalog-management";

type BrandFieldErrors = Partial<Record<keyof BrandFormValues, string>>;

type UploadResponse = {
  key: string;
  mimeType: string;
  size: number;
  url: string;
};

export default function BrandsPage() {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.ProductsRead}>
        <BrandsContent />
      </ProtectedRoute>
    </AdminShell>
  );
}

function BrandsContent() {
  const { api, hasPermission } = useAdminSession();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingBrand, setEditingBrand] = useState<AdminBrand | null>(null);
  const [formValues, setFormValues] = useState<BrandFormValues>(
    createEmptyBrandFormValues()
  );
  const [fieldErrors, setFieldErrors] = useState<BrandFieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);

  const brandsQuery = useQuery({
    queryFn: () => api.request<AdminBrand[]>("/admin/brands"),
    queryKey: ["admin", "brands", "managed"]
  });
  const createMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildBrandPayload>) =>
      api.request<AdminBrand>("/admin/brands", {
        body: JSON.stringify(payload),
        method: "POST"
      })
  });
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload
    }: {
      id: string;
      payload: ReturnType<typeof buildBrandPayload>;
    }) =>
      api.request<AdminBrand>(`/admin/brands/${id}`, {
        body: JSON.stringify(payload),
        method: "PATCH"
      })
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.request<void>(`/admin/brands/${id}`, {
        method: "DELETE"
      })
  });

  const brands = useMemo(() => brandsQuery.data ?? [], [brandsQuery.data]);
  const filteredBrands = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    if (!searchText) {
      return brands;
    }

    return brands.filter(
      (brand) =>
        brand.name.toLowerCase().includes(searchText) ||
        brand.slug.toLowerCase().includes(searchText)
    );
  }, [brands, search]);
  const canCreate = hasPermission(ADMIN_PERMISSION.ProductsCreate);
  const canUpdate = hasPermission(ADMIN_PERMISSION.ProductsUpdate);
  const canDelete = hasPermission(ADMIN_PERMISSION.ProductsDelete);
  const mutationError =
    getErrorMessage(createMutation.error) ??
    getErrorMessage(updateMutation.error) ??
    getErrorMessage(deleteMutation.error) ??
    uploadError;
  const isMutating =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  async function refreshBrands() {
    await queryClient.invalidateQueries({
      queryKey: ["admin", "brands"]
    });
  }

  function startCreate() {
    setEditingBrand(null);
    setFormValues(createEmptyBrandFormValues());
    setFieldErrors({});
    setMessage(null);
    setUploadError(null);
  }

  function startEdit(brand: AdminBrand) {
    setEditingBrand(brand);
    setFormValues(brandToFormValues(brand));
    setFieldErrors({});
    setMessage(null);
    setUploadError(null);
  }

  function updateValue<Key extends keyof BrandFormValues>(
    key: Key,
    value: BrandFormValues[Key]
  ) {
    setFormValues((current) => ({
      ...current,
      [key]: value
    }));
  }

  function generateSlug() {
    updateValue("slug", slugifyCatalogName(formValues.name));
  }

  async function uploadLogo(file: File | undefined) {
    if (!file) {
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);
      const body = new FormData();
      body.append("file", file);
      body.append("purpose", "brand_logo");

      if (editingBrand) {
        body.append("entityId", editingBrand.id);
      }

      const upload = await api.request<UploadResponse>("/uploads/image", {
        body,
        method: "POST"
      });
      updateValue("logoUrl", upload.url);
    } catch (error) {
      setUploadError(getErrorMessage(error) ?? "Logo upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = brandFormSchema.safeParse(formValues);

    if (!parsed.success) {
      setFieldErrors(getFieldErrors<BrandFormValues>(parsed.error));
      return;
    }

    setFieldErrors({});
    setMessage(null);
    setUploadError(null);
    const payload = buildBrandPayload(parsed.data);
    const savedBrand = editingBrand
      ? await updateMutation.mutateAsync({
          id: editingBrand.id,
          payload
        })
      : await createMutation.mutateAsync(payload);

    setEditingBrand(savedBrand);
    setFormValues(brandToFormValues(savedBrand));
    setMessage(editingBrand ? "Brand updated." : "Brand created.");
    await refreshBrands();
  }

  function requestDelete(brand: AdminBrand) {
    setConfirmation({
      body: `Soft delete ${brand.name}? Products can keep their historical brand link, but this brand will be hidden from active selection surfaces.`,
      confirmLabel: "Delete brand",
      onConfirm: async () => {
        setMessage(null);
        await deleteMutation.mutateAsync(brand.id);

        if (editingBrand?.id === brand.id) {
          startCreate();
        }
        setMessage("Brand soft deleted.");
        await refreshBrands();
      },
      title: "Delete brand"
    });
  }

  return (
    <>
      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Brands</p>
            <h2>Brand directory management</h2>
            <p className="panelSummary">
              Create, edit, upload logos, control visibility, and soft delete supplier
              or manufacturer brands.
            </p>
          </div>
          <div className="actionRow">
            <button
              className="ghostButton iconTextButton"
              onClick={() => void brandsQuery.refetch()}
              type="button"
            >
              <RefreshCw aria-hidden size={16} />
              <span>Refresh</span>
            </button>
            {canCreate ? (
              <button
                className="primaryButton iconTextButton"
                onClick={startCreate}
                type="button"
              >
                <Plus aria-hidden size={16} />
                <span>New brand</span>
              </button>
            ) : null}
          </div>
        </div>

        {message ? <p className="formSuccess">{message}</p> : null}
        {mutationError ? (
          <p className="formError" role="alert">
            {mutationError}
          </p>
        ) : null}

        <div className="metricGrid resourceMetrics">
          <article className="metric metric--primary">
            <span>Total brands</span>
            <strong>{brands.length}</strong>
          </article>
          <article className="metric metric--primary">
            <span>Active</span>
            <strong>{brands.filter((brand) => brand.isActive).length}</strong>
          </article>
          <article className="metric metric--warning">
            <span>Inactive</span>
            <strong>{brands.filter((brand) => !brand.isActive).length}</strong>
          </article>
          <article className="metric metric--neutral">
            <span>With logos</span>
            <strong>{brands.filter((brand) => brand.logoUrl).length}</strong>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Filters</p>
            <h2>Find brands</h2>
          </div>
        </div>
        <form className="productFilters" onSubmit={(event) => event.preventDefault()}>
          <label>
            Search
            <span className="searchInput">
              <Search aria-hidden size={16} />
              <input
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Acme Surgical"
                value={search}
              />
            </span>
          </label>
        </form>
      </section>

      <div className="splitGrid">
        <section className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Brand list</p>
              <h2>Managed brands</h2>
            </div>
          </div>

          {brandsQuery.isLoading ? (
            <div className="loadingBlock">Loading brands...</div>
          ) : null}
          {brandsQuery.isError ? (
            <p className="formError" role="alert">
              {getErrorMessage(brandsQuery.error) ?? "Unable to load brands."}
            </p>
          ) : null}
          {!brandsQuery.isLoading && filteredBrands.length === 0 ? (
            <div className="emptyPanel smallEmpty">
              No brands match the current search.
            </div>
          ) : null}
          {filteredBrands.length > 0 ? (
            <BrandTable
              brands={filteredBrands}
              canDelete={canDelete}
              canUpdate={canUpdate}
              editingBrandId={editingBrand?.id ?? null}
              isMutating={isMutating}
              onDelete={requestDelete}
              onEdit={startEdit}
            />
          ) : null}
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">{editingBrand ? "Edit brand" : "Create brand"}</p>
              <h2>{editingBrand?.name ?? "New brand"}</h2>
            </div>
            {editingBrand ? (
              <button
                className="ghostButton iconTextButton"
                onClick={startCreate}
                type="button"
              >
                <X aria-hidden size={16} />
                <span>Clear</span>
              </button>
            ) : null}
          </div>

          {!canCreate && !editingBrand ? (
            <div className="emptyPanel smallEmpty">
              Your role can view brands but cannot create them.
            </div>
          ) : (
            <BrandForm
              canSave={editingBrand ? canUpdate : canCreate}
              errors={fieldErrors}
              isSaving={createMutation.isPending || updateMutation.isPending}
              isUploading={isUploading}
              onGenerateSlug={generateSlug}
              onSubmit={handleSubmit}
              onUploadLogo={(file) => void uploadLogo(file)}
              onValueChange={updateValue}
              values={formValues}
            />
          )}
        </section>
      </div>

      <ConfirmationDialog
        confirmation={confirmation}
        isPending={isMutating}
        onCancel={() => setConfirmation(null)}
        onConfirmComplete={() => setConfirmation(null)}
      />
    </>
  );
}

function BrandTable({
  brands,
  canDelete,
  canUpdate,
  editingBrandId,
  isMutating,
  onDelete,
  onEdit
}: {
  brands: AdminBrand[];
  canDelete: boolean;
  canUpdate: boolean;
  editingBrandId: string | null;
  isMutating: boolean;
  onDelete: (brand: AdminBrand) => void;
  onEdit: (brand: AdminBrand) => void;
}) {
  return (
    <div className="resourceTable" role="table">
      <div className="resourceTableHeader catalogTableHeader" role="row">
        <strong role="columnheader">Brand</strong>
        <strong role="columnheader">Slug</strong>
        <strong role="columnheader">Status</strong>
        <strong role="columnheader">Actions</strong>
      </div>
      {brands.map((brand) => (
        <div
          className="resourceTableRow catalogTableRow"
          data-active={editingBrandId === brand.id}
          key={brand.id}
          role="row"
        >
          <span role="cell">
            <strong>{brand.name}</strong>
            <em>{brand.logoUrl ? "Logo available" : "No logo"}</em>
          </span>
          <span role="cell">{brand.slug}</span>
          <span role="cell">
            <span
              className={`statusBadge statusBadge--${brand.isActive ? "active" : "inactive"}`}
            >
              {formatCatalogStatus(brand.isActive)}
            </span>
          </span>
          <span className="tableActions" role="cell">
            <button
              className="ghostButton iconTextButton"
              disabled={!canUpdate}
              onClick={() => onEdit(brand)}
              type="button"
            >
              <Pencil aria-hidden size={16} />
              <span>Edit</span>
            </button>
            <button
              className="dangerButton iconTextButton"
              disabled={!canDelete || isMutating}
              onClick={() => onDelete(brand)}
              type="button"
            >
              <Trash2 aria-hidden size={16} />
              <span>Delete</span>
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}

function BrandForm({
  canSave,
  errors,
  isSaving,
  isUploading,
  onGenerateSlug,
  onSubmit,
  onUploadLogo,
  onValueChange,
  values
}: {
  canSave: boolean;
  errors: BrandFieldErrors;
  isSaving: boolean;
  isUploading: boolean;
  onGenerateSlug: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onUploadLogo: (file: File | undefined) => void;
  onValueChange: <Key extends keyof BrandFormValues>(
    key: Key,
    value: BrandFormValues[Key]
  ) => void;
  values: BrandFormValues;
}) {
  return (
    <form className="formStack productForm" onSubmit={onSubmit}>
      <div className="formGrid">
        <TextField
          error={errors.name}
          label="Name"
          onChange={(value) => onValueChange("name", value)}
          value={values.name}
        />
        <div className="slugField">
          <TextField
            error={errors.slug}
            label="Slug"
            onChange={(value) => onValueChange("slug", value)}
            value={values.slug}
          />
          <button className="ghostButton" onClick={onGenerateSlug} type="button">
            Generate
          </button>
        </div>
      </div>
      <TextAreaField
        error={errors.description}
        label="Description"
        onChange={(value) => onValueChange("description", value)}
        value={values.description}
      />
      <div className="assetRow singleAssetRow">
        <TextField
          error={errors.logoUrl}
          label="Logo URL"
          onChange={(value) => onValueChange("logoUrl", value)}
          value={values.logoUrl}
        />
        <label className="fileUploadButton">
          <ImageUp aria-hidden size={16} />
          <span>{isUploading ? "Uploading..." : "Upload"}</span>
          <input
            accept="image/*"
            disabled={isUploading}
            onChange={(event) => onUploadLogo(event.target.files?.[0])}
            type="file"
          />
        </label>
      </div>
      <label className="checkField rowCheck">
        <input
          checked={values.isActive}
          onChange={(event) => onValueChange("isActive", event.target.checked)}
          type="checkbox"
        />
        <span>Active in catalog</span>
      </label>
      <div className="actionRow">
        <button
          className="primaryButton iconTextButton"
          disabled={!canSave || isSaving}
          type="submit"
        >
          <CheckCircle2 aria-hidden size={16} />
          <span>{isSaving ? "Saving..." : "Save brand"}</span>
        </button>
        {!canSave ? (
          <span className="helperText">Your role cannot save brand changes.</span>
        ) : null}
      </div>
    </form>
  );
}

function TextField({
  error,
  label,
  onChange,
  value
}: {
  error?: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label>
      {label}
      <input onChange={(event) => onChange(event.target.value)} value={value} />
      {error ? <span className="fieldError">{error}</span> : null}
    </label>
  );
}

function TextAreaField({
  error,
  label,
  onChange,
  value
}: {
  error?: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label>
      {label}
      <textarea onChange={(event) => onChange(event.target.value)} value={value} />
      {error ? <span className="fieldError">{error}</span> : null}
    </label>
  );
}

function getFieldErrors<TFields extends Record<string, unknown>>(error: z.ZodError) {
  const flattened = error.flatten().fieldErrors as Record<string, string[] | undefined>;
  const errors: Partial<Record<keyof TFields, string>> = {};

  for (const [field, messages] of Object.entries(flattened)) {
    if (messages?.[0]) {
      errors[field as keyof TFields] = messages[0];
    }
  }

  return errors;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}
