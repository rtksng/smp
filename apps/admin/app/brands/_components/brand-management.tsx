"use client";

import {
  BulkActions,
  BulkPageCheckbox,
  BulkRowCheckbox
} from "@/components/admin/bulk-actions";
import { useBulkSelection, type BulkSelection } from "@/lib/use-bulk-selection";
import { activeResourceBulkActions } from "@/lib/bulk-resource-actions";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  ImageUp,
  ListPlus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  ConfirmationDialog,
  type ConfirmationState
} from "@/components/admin/confirmation-dialog";
import { CatalogBulkCreatePage as CatalogBulkCreateWorkspace } from "@/components/admin/catalog-bulk-create-page";
import "@/components/admin/catalog-management.css";
import { EmptyState } from "@/components/admin/empty-state";
import { FileUploadButton } from "@/components/admin/file-upload-button";
import { LoadingState } from "@/components/admin/loading-state";
import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AdminShell } from "../../admin-shell";
import { ProtectedRoute, useAdminSession } from "../../../lib/admin-session";
import { ADMIN_PERMISSION } from "../../../lib/permissions";
import type { CatalogBulkCreatePayload } from "../../../lib/catalog-bulk-create";
import {
  BRAND_BULK_CREATE_PATH,
  BRAND_CREATE_PATH,
  BRAND_LIST_PATH,
  brandFormSchema,
  brandToFormValues,
  buildBrandEditPath,
  buildBrandPayload,
  createEmptyBrandFormValues,
  slugifyCatalogName,
  type AdminBrand,
  type BrandFormValues
} from "../../../lib/catalog-management";

type BrandFieldErrors = Partial<Record<keyof BrandFormValues, string>>;
type BrandView = "create" | "edit" | "list";

type UploadResponse = {
  key: string;
  mimeType: string;
  size: number;
  url: string;
};

export function BrandManagementPage({
  brandId = null,
  view
}: {
  brandId?: string | null;
  view: BrandView;
}) {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.ProductsRead}>
        <BrandsContent brandId={brandId} view={view} />
      </ProtectedRoute>
    </AdminShell>
  );
}

export function BrandBulkCreatePage() {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.ProductsCreate}>
        <BrandBulkCreateContent />
      </ProtectedRoute>
    </AdminShell>
  );
}

function BrandBulkCreateContent() {
  const { api } = useAdminSession();
  const brandsQuery = useQuery({
    queryFn: () => api.request<AdminBrand[]>("/admin/brands"),
    queryKey: ["admin", "brands", "managed"]
  });

  if (brandsQuery.isLoading) {
    return (
      <Card className="panel catalogFormPanel">
        <LoadingState label="Loading brand options..." />
      </Card>
    );
  }

  if (brandsQuery.isError) {
    return (
      <Card className="panel catalogFormPanel">
        <p className="formError" role="alert">
          {getErrorMessage(brandsQuery.error) ?? "Unable to load brands."}
        </p>
      </Card>
    );
  }

  return (
    <CatalogBulkCreateWorkspace
      backHref={BRAND_LIST_PATH}
      existingSlugs={(brandsQuery.data ?? []).map((brand) => brand.slug)}
      kind="brand"
      onComplete={() => brandsQuery.refetch()}
      onCreate={(payload: CatalogBulkCreatePayload) =>
        api.request<AdminBrand>("/admin/brands", {
          body: JSON.stringify(payload),
          method: "POST"
        })
      }
    />
  );
}

function BrandsContent({ brandId, view }: { brandId: string | null; view: BrandView }) {
  const { api, hasPermission } = useAdminSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [formValues, setFormValues] = useState<BrandFormValues>(
    createEmptyBrandFormValues()
  );
  const [fieldErrors, setFieldErrors] = useState<BrandFieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);

  const brandsQuery = useQuery({
    enabled: view !== "create",
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
      api.request<AdminBrand>(`/admin/brands/${encodeURIComponent(id)}`, {
        body: JSON.stringify(payload),
        method: "PATCH"
      })
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.request<void>(`/admin/brands/${encodeURIComponent(id)}`, {
        method: "DELETE"
      })
  });

  const brands = useMemo(() => brandsQuery.data ?? [], [brandsQuery.data]);
  const editingBrand = useMemo(
    () => brands.find((brand) => brand.id === brandId) ?? null,
    [brandId, brands]
  );
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
  const bulk = useBulkSelection(search, filteredBrands);
  const canCreate = hasPermission(ADMIN_PERMISSION.ProductsCreate);
  const canUpdate = hasPermission(ADMIN_PERMISSION.ProductsUpdate);
  const canDelete = hasPermission(ADMIN_PERMISSION.ProductsDelete);
  const isEditView = view === "edit";
  const isFormView = view === "create" || isEditView;
  const canSave = isEditView ? canUpdate : canCreate;
  const mutationError =
    getErrorMessage(createMutation.error) ??
    getErrorMessage(updateMutation.error) ??
    getErrorMessage(deleteMutation.error) ??
    uploadError;
  const isMutating =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const editMissing =
    isEditView && !brandsQuery.isLoading && !brandsQuery.isError && !editingBrand;

  useEffect(() => {
    setFieldErrors({});
    setMessage(null);
    setUploadError(null);

    if (view === "create") {
      setFormValues(createEmptyBrandFormValues());
    }
  }, [view]);

  useEffect(() => {
    if (!isEditView || !editingBrand) {
      return;
    }

    setFormValues(brandToFormValues(editingBrand));
    setFieldErrors({});
    setUploadError(null);
  }, [editingBrand, isEditView]);

  async function refreshBrands() {
    await queryClient.invalidateQueries({
      queryKey: ["admin", "brands"]
    });
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

      if (isEditView && brandId) {
        body.append("entityId", brandId);
      }

      const upload = await api.request<UploadResponse>("/uploads/image", {
        body,
        method: "POST"
      });
      updateValue("logoUrl", upload.url);
    } catch (error) {
      setUploadError(getErrorMessage(error) ?? "Brand image upload failed.");
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

    try {
      if (isEditView) {
        if (!brandId) {
          setMessage(null);
          setUploadError("Brand ID is missing.");
          return;
        }

        await updateMutation.mutateAsync({
          id: brandId,
          payload
        });
      } else {
        await createMutation.mutateAsync(payload);
      }

      await refreshBrands();
      router.push(BRAND_LIST_PATH);
    } catch {
      // React Query exposes the request error through mutationError above.
      return;
    }
  }

  function requestDelete(brand: AdminBrand) {
    setConfirmation({
      body: `Soft delete ${brand.name}? Products can keep their historical brand link, but this brand will be hidden from active selection surfaces.`,
      confirmLabel: "Delete brand",
      onConfirm: async () => {
        setMessage(null);
        await deleteMutation.mutateAsync(brand.id);
        setMessage("Brand soft deleted.");
        await refreshBrands();
      },
      title: "Delete brand"
    });
  }

  if (isFormView) {
    return (
      <>
        <Card className="panel catalogFormPanel">
          <PageHeader
            className="catalogFormHeader"
            level={2}
            actions={
              <Button asChild className="iconTextButton" variant="outline">
                <Link href={BRAND_LIST_PATH}>
                  <ArrowLeft aria-hidden size={16} />
                  <span>Back to list</span>
                </Link>
              </Button>
            }
            eyebrow={isEditView ? "Edit brand" : "New brand"}
            summary={
              isEditView
                ? "Update brand details, image, slug, and catalog visibility."
                : "Create a supplier or manufacturer brand for catalog use."
            }
            title={isEditView ? (editingBrand?.name ?? "Edit brand") : "Create brand"}
          />

          {mutationError ? (
            <p className="formError" role="alert">
              {mutationError}
            </p>
          ) : null}
          {isEditView && brandsQuery.isLoading ? (
            <LoadingState label="Loading brand..." />
          ) : null}
          {isEditView && brandsQuery.isError ? (
            <p className="formError" role="alert">
              {getErrorMessage(brandsQuery.error) ?? "Unable to load brand."}
            </p>
          ) : null}
          {editMissing ? (
            <EmptyState
              body="This brand was not found or is no longer available."
              title="Brand unavailable"
            />
          ) : null}
          {!canCreate && view === "create" ? (
            <EmptyState
              body="Your role can view brands but cannot create them."
              title="Create access unavailable"
            />
          ) : null}
          {!canUpdate && isEditView && editingBrand ? (
            <EmptyState
              body="Your role can view brands but cannot edit them."
              title="Edit access unavailable"
            />
          ) : null}
          {view === "create" || editingBrand ? (
            <BrandForm
              canSave={canSave}
              errors={fieldErrors}
              isEdit={isEditView}
              isSaving={createMutation.isPending || updateMutation.isPending}
              isUploading={isUploading}
              onGenerateSlug={generateSlug}
              onSubmit={handleSubmit}
              onUploadLogo={(file) => void uploadLogo(file)}
              onValueChange={updateValue}
              values={formValues}
            />
          ) : null}
        </Card>
      </>
    );
  }

  return (
    <>
      <Card className="panel catalogOverviewPanel">
        <PageHeader
          className="catalogOverviewHeader"
          level={2}
          actions={
            <>
              <Button
                className="iconTextButton"
                onClick={() => void brandsQuery.refetch()}
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden size={16} />
                <span>Refresh</span>
              </Button>
              {canCreate ? (
                <>
                  <Button asChild className="iconTextButton" variant="outline">
                    <Link href={BRAND_BULK_CREATE_PATH}>
                      <ListPlus aria-hidden size={16} />
                      <span className="catalogActionLabelFull">Bulk create brands</span>
                      <span className="catalogActionLabelCompact">Bulk</span>
                    </Link>
                  </Button>
                  <Button asChild className="iconTextButton">
                    <Link href={BRAND_CREATE_PATH}>
                      <Plus aria-hidden size={16} />
                      <span className="catalogActionLabelFull">New brand</span>
                      <span className="catalogActionLabelCompact">New</span>
                    </Link>
                  </Button>
                </>
              ) : null}
            </>
          }
          eyebrow="Brands"
          summary="Review, search, edit, and soft delete supplier or manufacturer brands."
          title="Brand directory management"
        />

        {message ? <p className="formSuccess">{message}</p> : null}
        {mutationError ? (
          <p className="formError" role="alert">
            {mutationError}
          </p>
        ) : null}

        <div className="metricGrid resourceMetrics catalogMetrics">
          <MetricCard label="Total brands" tone="primary" value={brands.length} />
          <MetricCard
            label="Active"
            tone="primary"
            value={brands.filter((brand) => brand.isActive).length}
          />
          <MetricCard
            label="Inactive"
            tone="warning"
            value={brands.filter((brand) => !brand.isActive).length}
          />
          <MetricCard
            label="With logos"
            value={brands.filter((brand) => brand.logoUrl).length}
          />
        </div>
      </Card>

      <Card className="panel my-3 catalogListPanel">
        <PageHeader
          actions={
            <Label className="catalogListSearch">
              <span className="sr-only">Search brands</span>
              <span className="searchInput">
                <Search aria-hidden size={16} />
                <Input
                  aria-label="Search brands"
                  disabled={bulk.isBusy}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search brands"
                  value={search}
                />
              </span>
            </Label>
          }
          className="catalogListHeader"
          level={2}
          eyebrow="Brand list"
          title="Managed brands"
        />

        {brandsQuery.isLoading ? <LoadingState label="Loading brands..." /> : null}
        {brandsQuery.isError ? (
          <p className="formError" role="alert">
            {getErrorMessage(brandsQuery.error) ?? "Unable to load brands."}
          </p>
        ) : null}
        {canUpdate ? (
          <div className="catalogBulkActions">
            <BulkActions
              key={bulk.scope}
              selection={bulk}
              actions={activeResourceBulkActions<AdminBrand>(api, "brands")}
              total={filteredBrands.length}
              disabled={brandsQuery.isFetching || brandsQuery.isError || isMutating}
              loadAll={async () => filteredBrands}
              getLabel={(brand) => brand.name}
              onComplete={refreshBrands}
            />
          </div>
        ) : null}
        {!brandsQuery.isLoading && !brandsQuery.isError ? (
          <BrandTable
            bulk={bulk}
            brands={filteredBrands}
            canDelete={canDelete}
            canUpdate={canUpdate}
            isMutating={isMutating || bulk.isBusy}
            onDelete={requestDelete}
          />
        ) : null}
      </Card>

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
  bulk,
  brands,
  canDelete,
  canUpdate,
  isMutating,
  onDelete
}: {
  bulk: BulkSelection<AdminBrand>;
  brands: AdminBrand[];
  canDelete: boolean;
  canUpdate: boolean;
  isMutating: boolean;
  onDelete: (brand: AdminBrand) => void;
}) {
  return (
    <div className="brandTableScroll">
      <p className="catalogTableHint" id="brands-table-hint">
        Swipe horizontally to see every brand field and action.
      </p>
      <Table
        aria-describedby="brands-table-hint"
        className="brandDataTable catalogDataTable"
        containerClassName="catalogTableViewport"
      >
        <TableHeader>
          <TableRow>
            {canUpdate ? (
              <TableHead className="bulkCheckboxCell">
                <BulkPageCheckbox selection={bulk} />
              </TableHead>
            ) : null}
            <TableHead>Brand</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Brand image</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {brands.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canUpdate ? 6 : 5}>
                No brands match the current search.
              </TableCell>
            </TableRow>
          ) : (
            brands.map((brand) => (
              <TableRow key={brand.id}>
                {canUpdate ? (
                  <TableCell className="bulkCheckboxCell">
                    <BulkRowCheckbox selection={bulk} item={brand} label={brand.name} />
                  </TableCell>
                ) : null}
                <TableCell>
                  <strong>{brand.name}</strong>
                  {brand.description ? (
                    <span className="tableSubtext">{brand.description}</span>
                  ) : null}
                </TableCell>
                <TableCell>{brand.slug}</TableCell>
                <TableCell>
                  {brand.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={`${brand.name} brand image`}
                      className="brandImagePreview"
                      src={brand.logoUrl}
                    />
                  ) : (
                    <span className="tableSubtext">No image</span>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={brand.isActive ? "active" : "inactive"} />
                </TableCell>
                <TableCell>
                  <span className="tableActions">
                    {canUpdate ? (
                      <Button
                        asChild
                        className="iconTextButton"
                        size="sm"
                        variant="outline"
                      >
                        <Link href={buildBrandEditPath(brand.id)}>
                          <Pencil aria-hidden size={16} />
                          <span>Edit</span>
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        className="iconTextButton"
                        disabled
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Pencil aria-hidden size={16} />
                        <span>Edit</span>
                      </Button>
                    )}
                    <Button
                      className="iconTextButton"
                      disabled={!canDelete || isMutating}
                      onClick={() => onDelete(brand)}
                      size="sm"
                      type="button"
                      variant="destructive"
                    >
                      <Trash2 aria-hidden size={16} />
                      <span>Delete</span>
                    </Button>
                  </span>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function BrandForm({
  canSave,
  errors,
  isEdit,
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
  isEdit: boolean;
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
          <Button onClick={onGenerateSlug} type="button" variant="outline">
            Generate
          </Button>
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
          label="Brand image"
          onChange={(value) => onValueChange("logoUrl", value)}
          value={values.logoUrl}
        />
        <FileUploadButton
          inputProps={{
            accept: "image/*",
            disabled: isUploading,
            onChange: (event) => onUploadLogo(event.target.files?.[0])
          }}
        >
          <ImageUp aria-hidden size={16} />
          <span>{isUploading ? "Uploading..." : "Upload image"}</span>
        </FileUploadButton>
      </div>
      <Label className="checkField rowCheck">
        <Checkbox
          checked={values.isActive}
          onCheckedChange={(checked) => onValueChange("isActive", checked === true)}
        />
        <span>Active in catalog</span>
      </Label>
      <div className="actionRow">
        <Button
          className="iconTextButton"
          disabled={!canSave || isSaving}
          type="submit"
        >
          <CheckCircle2 aria-hidden size={16} />
          <span>{isSaving ? "Saving..." : isEdit ? "Save changes" : "Save brand"}</span>
        </Button>
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
    <Label>
      {label}
      <Input onChange={(event) => onChange(event.target.value)} value={value} />
      {error ? <span className="fieldError">{error}</span> : null}
    </Label>
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
    <Label>
      {label}
      <Textarea onChange={(event) => onChange(event.target.value)} value={value} />
      {error ? <span className="fieldError">{error}</span> : null}
    </Label>
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
