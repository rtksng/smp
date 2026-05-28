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
  buildCategoryPayload,
  categoryFormSchema,
  categoryToFormValues,
  createEmptyCategoryFormValues,
  flattenCategoryOptions,
  formatCatalogStatus,
  slugifyCatalogName,
  type AdminCategory,
  type CategoryFormValues
} from "../../lib/catalog-management";

type CategoryFieldErrors = Partial<Record<keyof CategoryFormValues, string>>;

type UploadResponse = {
  key: string;
  mimeType: string;
  size: number;
  url: string;
};

export default function CategoriesPage() {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.ProductsRead}>
        <CategoriesContent />
      </ProtectedRoute>
    </AdminShell>
  );
}

function CategoriesContent() {
  const { api, hasPermission } = useAdminSession();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);
  const [formValues, setFormValues] = useState<CategoryFormValues>(
    createEmptyCategoryFormValues()
  );
  const [fieldErrors, setFieldErrors] = useState<CategoryFieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);

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
      api.request<AdminCategory>(`/admin/categories/${id}`, {
        body: JSON.stringify(payload),
        method: "PATCH"
      })
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.request<void>(`/admin/categories/${id}`, {
        method: "DELETE"
      })
  });

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const flattenedCategories = useMemo(
    () => flattenCategoryOptions(categories),
    [categories]
  );
  const filteredCategories = flattenedCategories.filter((category) => {
    const searchText = search.trim().toLowerCase();

    if (!searchText) {
      return true;
    }

    return (
      category.name.toLowerCase().includes(searchText) ||
      category.slug.toLowerCase().includes(searchText)
    );
  });
  const parentOptions = flattenedCategories.filter(
    (category) => !collectCategoryIds(editingCategory).has(category.id)
  );
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

  async function refreshCategories() {
    await queryClient.invalidateQueries({
      queryKey: ["admin", "categories"]
    });
  }

  function startCreate() {
    setEditingCategory(null);
    setFormValues(createEmptyCategoryFormValues());
    setFieldErrors({});
    setMessage(null);
    setUploadError(null);
  }

  function startEdit(category: AdminCategory) {
    setEditingCategory(category);
    setFormValues(categoryToFormValues(category));
    setFieldErrors({});
    setMessage(null);
    setUploadError(null);
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

      if (editingCategory) {
        body.append("entityId", editingCategory.id);
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
    const savedCategory = editingCategory
      ? await updateMutation.mutateAsync({
          id: editingCategory.id,
          payload
        })
      : await createMutation.mutateAsync(payload);

    setEditingCategory(savedCategory);
    setFormValues(categoryToFormValues(savedCategory));
    setMessage(editingCategory ? "Category updated." : "Category created.");
    await refreshCategories();
  }

  function requestDelete(category: AdminCategory) {
    setConfirmation({
      body: `Soft delete ${category.name}? Child categories will also be hidden from the catalog.`,
      confirmLabel: "Delete category",
      onConfirm: async () => {
        setMessage(null);
        await deleteMutation.mutateAsync(category.id);

        if (editingCategory?.id === category.id) {
          startCreate();
        }
        setMessage("Category soft deleted.");
        await refreshCategories();
      },
      title: "Delete category"
    });
  }

  return (
    <>
      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Categories</p>
            <h2>Category hierarchy management</h2>
            <p className="panelSummary">
              Create, edit, upload category images, control visibility, and soft delete
              catalog categories.
            </p>
          </div>
          <div className="actionRow">
            <button
              className="ghostButton iconTextButton"
              onClick={() => void categoriesQuery.refetch()}
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
                <span>New category</span>
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
            <span>Total categories</span>
            <strong>{flattenedCategories.length}</strong>
          </article>
          <article className="metric metric--neutral">
            <span>Root categories</span>
            <strong>{categories.length}</strong>
          </article>
          <article className="metric metric--primary">
            <span>Active</span>
            <strong>
              {flattenedCategories.filter((item) => item.isActive).length}
            </strong>
          </article>
          <article className="metric metric--warning">
            <span>Inactive</span>
            <strong>
              {flattenedCategories.filter((item) => !item.isActive).length}
            </strong>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Filters</p>
            <h2>Find categories</h2>
          </div>
        </div>
        <form className="productFilters" onSubmit={(event) => event.preventDefault()}>
          <label>
            Search
            <span className="searchInput">
              <Search aria-hidden size={16} />
              <input
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Surgical instruments"
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
              <p className="eyebrow">Category list</p>
              <h2>Visible management tree</h2>
            </div>
          </div>

          {categoriesQuery.isLoading ? (
            <div className="loadingBlock">Loading categories...</div>
          ) : null}
          {categoriesQuery.isError ? (
            <p className="formError" role="alert">
              {getErrorMessage(categoriesQuery.error) ?? "Unable to load categories."}
            </p>
          ) : null}
          {!categoriesQuery.isLoading && filteredCategories.length === 0 ? (
            <div className="emptyPanel smallEmpty">
              No categories match the current search.
            </div>
          ) : null}
          {filteredCategories.length > 0 ? (
            <CategoryTable
              canDelete={canDelete}
              canUpdate={canUpdate}
              categories={filteredCategories}
              editingCategoryId={editingCategory?.id ?? null}
              isMutating={isMutating}
              onDelete={requestDelete}
              onEdit={startEdit}
            />
          ) : null}
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">
                {editingCategory ? "Edit category" : "Create category"}
              </p>
              <h2>{editingCategory?.name ?? "New category"}</h2>
            </div>
            {editingCategory ? (
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

          {!canCreate && !editingCategory ? (
            <div className="emptyPanel smallEmpty">
              Your role can view categories but cannot create them.
            </div>
          ) : (
            <CategoryForm
              canSave={editingCategory ? canUpdate : canCreate}
              errors={fieldErrors}
              isSaving={createMutation.isPending || updateMutation.isPending}
              isUploading={isUploading}
              onGenerateSlug={generateSlug}
              onSubmit={handleSubmit}
              onUploadImage={(file) => void uploadImage(file)}
              onValueChange={updateValue}
              parentOptions={parentOptions}
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

function CategoryTable({
  canDelete,
  canUpdate,
  categories,
  editingCategoryId,
  isMutating,
  onDelete,
  onEdit
}: {
  canDelete: boolean;
  canUpdate: boolean;
  categories: Array<AdminCategory & { depth: number }>;
  editingCategoryId: string | null;
  isMutating: boolean;
  onDelete: (category: AdminCategory) => void;
  onEdit: (category: AdminCategory) => void;
}) {
  return (
    <div className="resourceTable" role="table">
      <div className="resourceTableHeader catalogTableHeader" role="row">
        <strong role="columnheader">Category</strong>
        <strong role="columnheader">Slug</strong>
        <strong role="columnheader">Status</strong>
        <strong role="columnheader">Actions</strong>
      </div>
      {categories.map((category) => (
        <div
          className="resourceTableRow catalogTableRow"
          data-active={editingCategoryId === category.id}
          key={category.id}
          role="row"
        >
          <span role="cell">
            <strong style={{ paddingLeft: category.depth * 18 }}>
              {category.name}
            </strong>
            <em>{category.parentId ? "Child category" : "Root category"}</em>
          </span>
          <span role="cell">{category.slug}</span>
          <span role="cell">
            <span
              className={`statusBadge statusBadge--${category.isActive ? "active" : "inactive"}`}
            >
              {formatCatalogStatus(category.isActive)}
            </span>
          </span>
          <span className="tableActions" role="cell">
            <button
              className="ghostButton iconTextButton"
              disabled={!canUpdate}
              onClick={() => onEdit(category)}
              type="button"
            >
              <Pencil aria-hidden size={16} />
              <span>Edit</span>
            </button>
            <button
              className="dangerButton iconTextButton"
              disabled={!canDelete || isMutating}
              onClick={() => onDelete(category)}
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

function CategoryForm({
  canSave,
  errors,
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
  isSaving: boolean;
  isUploading: boolean;
  onGenerateSlug: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onUploadImage: (file: File | undefined) => void;
  onValueChange: <Key extends keyof CategoryFormValues>(
    key: Key,
    value: CategoryFormValues[Key]
  ) => void;
  parentOptions: Array<AdminCategory & { depth: number }>;
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
          <button className="ghostButton" onClick={onGenerateSlug} type="button">
            Generate
          </button>
        </div>
        <label>
          Parent category
          <select
            onChange={(event) => onValueChange("parentId", event.target.value)}
            value={values.parentId}
          >
            <option value="">Root category</option>
            {parentOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {"  ".repeat(category.depth)}
                {category.name}
              </option>
            ))}
          </select>
          {errors.parentId ? (
            <span className="fieldError">{errors.parentId}</span>
          ) : null}
        </label>
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
        <label className="fileUploadButton">
          <ImageUp aria-hidden size={16} />
          <span>{isUploading ? "Uploading..." : "Upload"}</span>
          <input
            accept="image/*"
            disabled={isUploading}
            onChange={(event) => onUploadImage(event.target.files?.[0])}
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
          <span>{isSaving ? "Saving..." : "Save category"}</span>
        </button>
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
    <label>
      {label}
      <input
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
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

function collectCategoryIds(category: AdminCategory | null) {
  const ids = new Set<string>();

  if (!category) {
    return ids;
  }

  const visit = (item: AdminCategory) => {
    ids.add(item.id);
    item.children.forEach(visit);
  };

  visit(category);
  return ids;
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
