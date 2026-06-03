"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  ImageUp,
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
import { ConfirmationDialog, type ConfirmationState } from "@/components/admin/confirmation-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { FileUploadButton } from "@/components/admin/file-upload-button";
import { LoadingState } from "@/components/admin/loading-state";
import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
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
import {
  buildCategoryEditPath,
  buildCategoryPayload,
  CATEGORY_CREATE_PATH,
  CATEGORY_LIST_PATH,
  categoryFormSchema,
  categoryToFormValues,
  createEmptyCategoryFormValues,
  filterRootCategories,
  flattenCategoryOptions,
  formatChildCategoryCount,
  getRootCategoryOptions,
  slugifyCatalogName,
  type AdminCategory,
  type CategoryFormValues,
  type CategoryOption
} from "../../../lib/catalog-management";
import { ADMIN_PERMISSION } from "../../../lib/permissions";

type CategoryFieldErrors = Partial<Record<keyof CategoryFormValues, string>>;
type CategoryView = "create" | "edit" | "list";
const ROOT_CATEGORY_VALUE = "__root_category__";

type UploadResponse = {
  key: string;
  mimeType: string;
  size: number;
  url: string;
};

export function CategoryManagementPage({
  categoryId = null,
  view
}: {
  categoryId?: string | null;
  view: CategoryView;
}) {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.ProductsRead}>
        <CategoriesContent categoryId={categoryId} view={view} />
      </ProtectedRoute>
    </AdminShell>
  );
}

function CategoriesContent({
  categoryId,
  view
}: {
  categoryId: string | null;
  view: CategoryView;
}) {
  const { api, hasPermission } = useAdminSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [formValues, setFormValues] = useState<CategoryFormValues>(
    createEmptyCategoryFormValues()
  );
  const [fieldErrors, setFieldErrors] = useState<CategoryFieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const [childCategoryModal, setChildCategoryModal] =
    useState<AdminCategory | null>(null);

  const categoriesQuery = useQuery({
    queryFn: () => api.request<AdminCategory[]>("/admin/categories"),
    queryKey: ["admin", "categories", "managed"]
  });
  const createMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildCategoryPayload>) =>
      api.request<AdminCategory>("/admin/categories", {
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
      payload: ReturnType<typeof buildCategoryPayload>;
    }) =>
      api.request<AdminCategory>(`/admin/categories/${encodeURIComponent(id)}`, {
        body: JSON.stringify(payload),
        method: "PATCH"
      })
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.request<void>(`/admin/categories/${encodeURIComponent(id)}`, {
        method: "DELETE"
      })
  });

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const flattenedCategories = useMemo(
    () => flattenCategoryOptions(categories),
    [categories]
  );
  const editingCategory = useMemo(
    () => flattenedCategories.find((category) => category.id === categoryId) ?? null,
    [categoryId, flattenedCategories]
  );
  const filteredRootCategories = useMemo(
    () => filterRootCategories(categories, search),
    [categories, search]
  );
  const parentOptions = useMemo(
    () =>
      getRootCategoryOptions(
        categories,
        editingCategory?.parentId === null ? editingCategory.id : null
      ),
    [categories, editingCategory]
  );
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
    isEditView &&
    !categoriesQuery.isLoading &&
    !categoriesQuery.isError &&
    !editingCategory;

  useEffect(() => {
    setFieldErrors({});
    setMessage(null);
    setUploadError(null);

    if (view === "create") {
      setFormValues(createEmptyCategoryFormValues());
    }
  }, [view]);

  useEffect(() => {
    if (!isEditView || !editingCategory) {
      return;
    }

    setFormValues(categoryToFormValues(editingCategory));
    setFieldErrors({});
    setUploadError(null);
  }, [editingCategory, isEditView]);

  async function refreshCategories() {
    await queryClient.invalidateQueries({
      queryKey: ["admin", "categories"]
    });
  }

  function updateValue<Key extends keyof CategoryFormValues>(
    key: Key,
    value: CategoryFormValues[Key]
  ) {
    setFormValues((current) => ({
      ...current,
      [key]: value
    }));
  }

  function generateSlug() {
    updateValue("slug", slugifyCatalogName(formValues.name));
  }

  async function uploadImage(file: File | undefined) {
    if (!file) {
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);
      const body = new FormData();
      body.append("file", file);
      body.append("purpose", "category_image");

      if (isEditView && categoryId) {
        body.append("entityId", categoryId);
      }

      const upload = await api.request<UploadResponse>("/uploads/image", {
        body,
        method: "POST"
      });
      updateValue("imageUrl", upload.url);
    } catch (error) {
      setUploadError(getErrorMessage(error) ?? "Image upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = categoryFormSchema.safeParse(formValues);

    if (!parsed.success) {
      setFieldErrors(getFieldErrors<CategoryFormValues>(parsed.error));
      return;
    }

    setFieldErrors({});
    setMessage(null);
    setUploadError(null);
    const payload = buildCategoryPayload(parsed.data);

    if (isEditView) {
      if (!categoryId) {
        setUploadError("Category ID is missing.");
        return;
      }

      await updateMutation.mutateAsync({
        id: categoryId,
        payload
      });
    } else {
      await createMutation.mutateAsync(payload);
    }

    await refreshCategories();
    router.push(CATEGORY_LIST_PATH);
  }

  function requestDelete(category: AdminCategory) {
    setConfirmation({
      body: `Soft delete ${category.name}? Child categories will also be hidden from the catalog.`,
      confirmLabel: "Delete category",
      onConfirm: async () => {
        setMessage(null);
        await deleteMutation.mutateAsync(category.id);
        setMessage("Category soft deleted.");
        await refreshCategories();
      },
      title: "Delete category"
    });
  }

  if (isFormView) {
    return (
      <>
        <Card className="panel">
          <PageHeader
            level={2}
            actions={
              <Button asChild className="iconTextButton" variant="outline">
                <Link href={CATEGORY_LIST_PATH}>
                  <ArrowLeft aria-hidden size={16} />
                  <span>Back to list</span>
                </Link>
              </Button>
            }
            eyebrow={isEditView ? "Edit category" : "New category"}
            summary={
              isEditView
                ? "Update hierarchy, image, slug, sort order, and catalog visibility."
                : "Create a catalog category and optionally assign it under a parent."
            }
            title={
              isEditView
                ? (editingCategory?.name ?? "Edit category")
                : "Create category"
            }
          />

          {mutationError ? (
            <p className="formError" role="alert">
              {mutationError}
            </p>
          ) : null}
          {categoriesQuery.isLoading ? (
            <LoadingState
              label={isEditView ? "Loading category..." : "Loading category options..."}
            />
          ) : null}
          {categoriesQuery.isError ? (
            <p className="formError" role="alert">
              {getErrorMessage(categoriesQuery.error) ?? "Unable to load categories."}
            </p>
          ) : null}
          {editMissing ? (
            <EmptyState
              body="This category was not found or is no longer available."
              title="Category unavailable"
            />
          ) : null}
          {!canCreate && view === "create" ? (
            <EmptyState
              body="Your role can view categories but cannot create them."
              title="Create access unavailable"
            />
          ) : null}
          {!canUpdate && isEditView && editingCategory ? (
            <EmptyState
              body="Your role can view categories but cannot edit them."
              title="Edit access unavailable"
            />
          ) : null}
          {view === "create" || editingCategory ? (
            <CategoryForm
              canSave={canSave}
              errors={fieldErrors}
              isEdit={isEditView}
              isSaving={createMutation.isPending || updateMutation.isPending}
              isUploading={isUploading}
              onGenerateSlug={generateSlug}
              onSubmit={handleSubmit}
              onUploadImage={(file) => void uploadImage(file)}
              onValueChange={updateValue}
              parentOptions={parentOptions}
              values={formValues}
            />
          ) : null}
        </Card>
      </>
    );
  }

  return (
    <>
      <Card className="panel">
        <PageHeader
          level={2}
          actions={
            <>
              <Button
                className="iconTextButton"
                onClick={() => void categoriesQuery.refetch()}
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden size={16} />
                <span>Refresh</span>
              </Button>
              {canCreate ? (
                <Button asChild className="iconTextButton">
                  <Link href={CATEGORY_CREATE_PATH}>
                    <Plus aria-hidden size={16} />
                    <span>New category</span>
                  </Link>
                </Button>
              ) : null}
            </>
          }
          eyebrow="Categories"
          summary="Review, search, edit, and soft delete catalog categories."
          title="Category hierarchy management"
        />

        {message ? <p className="formSuccess">{message}</p> : null}
        {mutationError ? (
          <p className="formError" role="alert">
            {mutationError}
          </p>
        ) : null}

        <div className="metricGrid resourceMetrics">
          <MetricCard
            label="Total categories"
            tone="primary"
            value={flattenedCategories.length}
          />
          <MetricCard label="Root categories" value={categories.length} />
          <MetricCard
            label="Active"
            tone="primary"
            value={flattenedCategories.filter((item) => item.isActive).length}
          />
          <MetricCard
            label="Inactive"
            tone="warning"
            value={flattenedCategories.filter((item) => !item.isActive).length}
          />
        </div>
      </Card>

      <Card className="panel">
        <form className="productFilters" onSubmit={(event) => event.preventDefault()}>
          <Label>
            Search categories
            <span className="searchInput">
              <Search aria-hidden size={16} />
              <Input
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Surgical instruments"
                value={search}
              />
            </span>
          </Label>
        </form>
      </Card>

      <Card className="panel">
        <PageHeader level={2} eyebrow="Category list" title="Managed categories" />

        {categoriesQuery.isLoading ? (
          <LoadingState label="Loading categories..." />
        ) : null}
        {categoriesQuery.isError ? (
          <p className="formError" role="alert">
            {getErrorMessage(categoriesQuery.error) ?? "Unable to load categories."}
          </p>
        ) : null}
        {!categoriesQuery.isLoading && !categoriesQuery.isError ? (
          <CategoryTable
            canDelete={canDelete}
            canUpdate={canUpdate}
            categories={filteredRootCategories}
            isMutating={isMutating}
            onDelete={requestDelete}
            onManageChildren={(category) => setChildCategoryModal(category)}
          />
        ) : null}
      </Card>

      <ChildCategoryModal
        canDelete={canDelete}
        canUpdate={canUpdate}
        isMutating={isMutating}
        onClose={() => setChildCategoryModal(null)}
        onDelete={(category) => {
          setChildCategoryModal(null);
          requestDelete(category);
        }}
        rootCategory={childCategoryModal}
      />

      <ConfirmationDialog
        confirmation={confirmation}
        isPending={isMutating}
        onCancel={() => setConfirmation(null)}
        onConfirmComplete={() => setConfirmation(null)}
      />
    </>
  );
}

function CategoryTable({
  canDelete,
  canUpdate,
  categories,
  isMutating,
  onDelete,
  onManageChildren
}: {
  canDelete: boolean;
  canUpdate: boolean;
  categories: AdminCategory[];
  isMutating: boolean;
  onDelete: (category: AdminCategory) => void;
  onManageChildren: (category: AdminCategory) => void;
}) {
  return (
    <div className="brandTableScroll">
      <Table className="brandDataTable categoryDataTable">
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Child categories</TableHead>
            <TableHead>Sort</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6}>No categories match the current search.</TableCell>
            </TableRow>
          ) : (
            categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell>
                  <strong>{category.name}</strong>
                  {category.description ? (
                    <span className="tableSubtext">{category.description}</span>
                  ) : null}
                </TableCell>
                <TableCell>{category.slug}</TableCell>
                <TableCell>
                  <ChildCategorySummary
                    category={category}
                    canUpdate={canUpdate}
                    onManageChildren={() => onManageChildren(category)}
                  />
                </TableCell>
                <TableCell>{category.sortOrder}</TableCell>
                <TableCell>
                  <StatusBadge status={category.isActive ? "active" : "inactive"} />
                </TableCell>
                <TableCell>
                  <span className="tableActions">
                    {canUpdate ? (
                      <Button asChild className="iconTextButton" size="sm" variant="outline">
                        <Link href={buildCategoryEditPath(category.id)}>
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
                      onClick={() => onDelete(category)}
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

function ChildCategorySummary({
  category,
  canUpdate,
  onManageChildren
}: {
  category: AdminCategory;
  canUpdate: boolean;
  onManageChildren: () => void;
}) {
  return (
    <span className="categoryChildSummary">
      <strong>{formatChildCategoryCount(category.children.length)}</strong>
      <Button
        className="iconTextButton"
        disabled={!canUpdate || category.children.length === 0}
        onClick={onManageChildren}
        size="sm"
        type="button"
        variant="outline"
      >
        <Pencil aria-hidden size={16} />
        <span>Edit</span>
      </Button>
    </span>
  );
}

function ChildCategoryModal({
  canDelete,
  canUpdate,
  isMutating,
  onClose,
  onDelete,
  rootCategory
}: {
  canDelete: boolean;
  canUpdate: boolean;
  isMutating: boolean;
  onClose: () => void;
  onDelete: (category: AdminCategory) => void;
  rootCategory: AdminCategory | null;
}) {
  if (!rootCategory) {
    return null;
  }

  return (
    <Dialog open={Boolean(rootCategory)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="categoryChildDialog">
        <DialogHeader>
          <p className="eyebrow">Child categories</p>
          <DialogTitle>{rootCategory.name}</DialogTitle>
          <DialogDescription className="panelSummary">
            Manage child categories for this root category.
          </DialogDescription>
        </DialogHeader>

        {rootCategory.children.length === 0 ? (
          <EmptyState body="No child categories available." title="No child categories" />
        ) : (
          <Table aria-label={`Child categories for ${rootCategory.name}`}>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rootCategory.children.map((subcategory) => (
                <TableRow key={subcategory.id}>
                  <TableCell>
                    <strong>{subcategory.name}</strong>
                  </TableCell>
                  <TableCell>{subcategory.slug}</TableCell>
                  <TableCell>
                    <StatusBadge status={subcategory.isActive ? "active" : "inactive"} />
                  </TableCell>
                  <TableCell>
                    <span className="tableActions categoryChildModalActions">
                      {canUpdate ? (
                        <Button asChild className="iconTextButton" size="sm" variant="outline">
                          <Link href={buildCategoryEditPath(subcategory.id)}>
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
                        onClick={() => onDelete(subcategory)}
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
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CategoryForm({
  canSave,
  errors,
  isEdit,
  isSaving,
  isUploading,
  onGenerateSlug,
  onSubmit,
  onUploadImage,
  onValueChange,
  parentOptions,
  values
}: {
  canSave: boolean;
  errors: CategoryFieldErrors;
  isEdit: boolean;
  isSaving: boolean;
  isUploading: boolean;
  onGenerateSlug: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onUploadImage: (file: File | undefined) => void;
  onValueChange: <Key extends keyof CategoryFormValues>(
    key: Key,
    value: CategoryFormValues[Key]
  ) => void;
  parentOptions: CategoryOption[];
  values: CategoryFormValues;
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
        <Label>
          Parent category
          <Select
            onValueChange={(value) =>
              onValueChange("parentId", value === ROOT_CATEGORY_VALUE ? "" : value)
            }
            value={values.parentId || ROOT_CATEGORY_VALUE}
          >
            <SelectTrigger>
              <SelectValue placeholder="Root category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ROOT_CATEGORY_VALUE}>Root category</SelectItem>
              {parentOptions.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.parentId ? (
            <span className="fieldError">{errors.parentId}</span>
          ) : null}
        </Label>
        <TextField
          error={errors.sortOrder}
          inputMode="numeric"
          label="Sort order"
          onChange={(value) => onValueChange("sortOrder", value)}
          value={values.sortOrder}
        />
      </div>
      <TextAreaField
        error={errors.description}
        label="Description"
        onChange={(value) => onValueChange("description", value)}
        value={values.description}
      />
      <div className="assetRow singleAssetRow">
        <TextField
          error={errors.imageUrl}
          label="Image URL"
          onChange={(value) => onValueChange("imageUrl", value)}
          value={values.imageUrl}
        />
        <FileUploadButton
          inputProps={{
            accept: "image/*",
            disabled: isUploading,
            onChange: (event) => onUploadImage(event.target.files?.[0])
          }}
        >
          <ImageUp aria-hidden size={16} />
          <span>{isUploading ? "Uploading..." : "Upload"}</span>
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
          <span>
            {isSaving ? "Saving..." : isEdit ? "Save changes" : "Save category"}
          </span>
        </Button>
        {!canSave ? (
          <span className="helperText">Your role cannot save category changes.</span>
        ) : null}
      </div>
    </form>
  );
}

function TextField({
  error,
  inputMode,
  label,
  onChange,
  value
}: {
  error?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <Label>
      {label}
      <Input
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
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
