"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  FileUp,
  ImageUp,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Search,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  useFieldArray,
  useForm,
  type FieldErrors,
  type UseFormReturn
} from "react-hook-form";
import { AdminShell } from "../admin-shell";
import { ProtectedRoute, useAdminSession } from "../../lib/admin-session";
import { ADMIN_PERMISSION } from "../../lib/permissions";
import {
  PRODUCT_DOCUMENT_TYPES,
  PRODUCT_STATUSES,
  buildProductPayload,
  createEmptyDocumentFormValue,
  createEmptyImageFormValue,
  createEmptyProductFormValues,
  createEmptyVariantFormValue,
  flattenCategories,
  productFormSchema,
  productToFormValues,
  slugifyProductName,
  type AdminBrand,
  type AdminCategory,
  type AdminProduct,
  type ProductFormValues,
  type ProductListResponse,
  type ProductPayload,
  type ProductStatus
} from "../../lib/product-form";

type BooleanFilter = "" | "false" | "true";

type ProductFilters = {
  brand: string;
  category: string;
  disposable: BooleanFilter;
  expirySensitive: BooleanFilter;
  medicalSpecialty: string;
  search: string;
  status: "" | ProductStatus;
  sterile: BooleanFilter;
};

type UploadResponse = {
  key: string;
  mimeType: string;
  size: number;
  url: string;
};

type ConfirmationState = {
  body: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  title: string;
};

const emptyFilters: ProductFilters = {
  brand: "",
  category: "",
  disposable: "",
  expirySensitive: "",
  medicalSpecialty: "",
  search: "",
  status: "",
  sterile: ""
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 2,
  style: "currency"
});

export function ProductManagementPage() {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.ProductsRead}>
        <ProductManagementContent />
      </ProtectedRoute>
    </AdminShell>
  );
}

function ProductManagementContent() {
  const { api, hasPermission } = useAdminSession();
  const queryClient = useQueryClient();
  const [draftFilters, setDraftFilters] = useState<ProductFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<ProductFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);

  const productsQuery = useQuery({
    queryFn: () =>
      api.request<ProductListResponse>("/admin/products", {
        query: buildProductQuery(appliedFilters, page)
      }),
    queryKey: ["admin", "products", appliedFilters, page]
  });
  const brandsQuery = useQuery({
    queryFn: () => api.request<AdminBrand[]>("/brands"),
    queryKey: ["admin", "brands"]
  });
  const categoriesQuery = useQuery({
    queryFn: () => api.request<AdminCategory[]>("/categories"),
    queryKey: ["admin", "categories"]
  });

  const createMutation = useMutation({
    mutationFn: (payload: ProductPayload) =>
      api.request<AdminProduct>("/admin/products", {
        body: JSON.stringify(payload),
        method: "POST"
      })
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ProductPayload> }) =>
      api.request<AdminProduct>(`/admin/products/${id}`, {
        body: JSON.stringify(payload),
        method: "PATCH"
      })
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.request<void>(`/admin/products/${id}`, {
        method: "DELETE"
      })
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProductStatus }) =>
      api.request<AdminProduct>(`/admin/products/${id}`, {
        body: JSON.stringify({ status }),
        method: "PATCH"
      })
  });

  const products = productsQuery.data?.items ?? [];
  const pagination = productsQuery.data?.pagination;
  const brands = brandsQuery.data ?? [];
  const categories = useMemo(
    () => flattenCategories(categoriesQuery.data ?? []),
    [categoriesQuery.data]
  );
  const canCreate = hasPermission(ADMIN_PERMISSION.ProductsCreate);
  const canUpdate = hasPermission(ADMIN_PERMISSION.ProductsUpdate);
  const canDelete = hasPermission(ADMIN_PERMISSION.ProductsDelete);
  const mutationError =
    getErrorMessage(createMutation.error) ??
    getErrorMessage(updateMutation.error) ??
    getErrorMessage(deleteMutation.error) ??
    getErrorMessage(statusMutation.error) ??
    uploadError;

  async function refreshProducts() {
    await queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
  }

  function handleFilterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters(draftFilters);
    setPage(1);
  }

  function resetFilters() {
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  }

  async function handleSave(values: ProductFormValues) {
    setMessage(null);
    setUploadError(null);
    const payload = buildProductPayload(values);
    const product = editingProduct
      ? await updateMutation.mutateAsync({ id: editingProduct.id, payload })
      : await createMutation.mutateAsync(payload);

    setEditingProduct(product);
    setMessage(editingProduct ? "Product updated." : "Product created.");
    await refreshProducts();
  }

  function startCreate() {
    setEditingProduct(null);
    setMessage(null);
    setUploadError(null);
  }

  function requestDeactivate(product: AdminProduct) {
    setConfirmation({
      body: `Deactivate ${product.name}? It will no longer be active in the catalog until it is reactivated.`,
      confirmLabel: "Deactivate",
      onConfirm: () => updateProductStatus(product, "INACTIVE"),
      title: "Deactivate product"
    });
  }

  async function updateProductStatus(product: AdminProduct, status: ProductStatus) {
    setMessage(null);
    const updatedProduct = await statusMutation.mutateAsync({
      id: product.id,
      status
    });

    if (editingProduct?.id === updatedProduct.id) {
      setEditingProduct(updatedProduct);
    }
    setMessage(status === "ACTIVE" ? "Product activated." : "Product deactivated.");
    await refreshProducts();
  }

  function requestDelete(product: AdminProduct) {
    setConfirmation({
      body: `Soft delete ${product.name}? This hides the product and deactivates its variants.`,
      confirmLabel: "Delete product",
      onConfirm: async () => {
        setMessage(null);
        await deleteMutation.mutateAsync(product.id);

        if (editingProduct?.id === product.id) {
          setEditingProduct(null);
        }
        setMessage("Product soft deleted.");
        await refreshProducts();
      },
      title: "Soft delete product"
    });
  }

  return (
    <>
      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Products</p>
            <h2>Product catalog management</h2>
            <p className="panelSummary">
              Search, filter, create, edit, upload assets, and manage product lifecycle.
            </p>
          </div>
          <div className="actionRow">
            <button
              className="ghostButton iconTextButton"
              onClick={() => void productsQuery.refetch()}
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
                <span>New product</span>
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
            <span>Total products</span>
            <strong>{pagination?.total ?? products.length}</strong>
          </article>
          <article className="metric metric--neutral">
            <span>Visible page</span>
            <strong>{products.length}</strong>
          </article>
          <article className="metric metric--warning">
            <span>Active</span>
            <strong>
              {products.filter((product) => product.status === "ACTIVE").length}
            </strong>
          </article>
          <article className="metric metric--neutral">
            <span>In stock</span>
            <strong>{products.filter((product) => product.inStock).length}</strong>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Catalog filters</p>
            <h2>Find products</h2>
          </div>
        </div>
        <ProductFilterForm
          brands={brands}
          categories={categories}
          filters={draftFilters}
          isLoading={brandsQuery.isLoading || categoriesQuery.isLoading}
          onChange={setDraftFilters}
          onReset={resetFilters}
          onSubmit={handleFilterSubmit}
        />
      </section>

      <div className="productManagementGrid">
        <section className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Product list</p>
              <h2>Catalog table</h2>
            </div>
            {pagination ? (
              <span>
                Page {pagination.page} of {Math.max(pagination.totalPages, 1)}
              </span>
            ) : null}
          </div>

          {productsQuery.isLoading ? (
            <div className="loadingBlock">Loading products...</div>
          ) : null}
          {productsQuery.isError ? (
            <p className="formError" role="alert">
              {getErrorMessage(productsQuery.error) ?? "Unable to load products."}
            </p>
          ) : null}
          {!productsQuery.isLoading && !productsQuery.isError && products.length === 0 ? (
            <div className="emptyPanel">No products match the selected filters.</div>
          ) : null}
          {products.length > 0 ? (
            <ProductTable
              canDelete={canDelete}
              canUpdate={canUpdate}
              editingProductId={editingProduct?.id ?? null}
              isMutating={deleteMutation.isPending || statusMutation.isPending}
              onActivate={(product) => void updateProductStatus(product, "ACTIVE")}
              onDeactivate={requestDeactivate}
              onDelete={requestDelete}
              onEdit={(product) => {
                setEditingProduct(product);
                setMessage(null);
                setUploadError(null);
              }}
              products={products}
            />
          ) : null}

          {pagination && pagination.totalPages > 1 ? (
            <div className="paginationControls">
              <button
                className="ghostButton"
                disabled={!pagination.hasPreviousPage}
                onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                type="button"
              >
                Previous
              </button>
              <span>
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                className="ghostButton"
                disabled={!pagination.hasNextPage}
                onClick={() => setPage((currentPage) => currentPage + 1)}
                type="button"
              >
                Next
              </button>
            </div>
          ) : null}
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">{editingProduct ? "Edit product" : "Create product"}</p>
              <h2>{editingProduct?.name ?? "New catalog product"}</h2>
            </div>
            {editingProduct ? (
              <button className="ghostButton iconTextButton" onClick={startCreate} type="button">
                <X aria-hidden size={16} />
                <span>Clear</span>
              </button>
            ) : null}
          </div>

          {!canCreate && !editingProduct ? (
            <div className="emptyPanel">Your role can view products but cannot create them.</div>
          ) : (
            <ProductForm
              brands={brands}
              canSave={editingProduct ? canUpdate : canCreate}
              categories={categories}
              editingProduct={editingProduct}
              isLookupLoading={brandsQuery.isLoading || categoriesQuery.isLoading}
              isSaving={createMutation.isPending || updateMutation.isPending}
              onSave={handleSave}
              onUploadError={setUploadError}
            />
          )}
        </section>
      </div>

      <ConfirmationDialog
        confirmation={confirmation}
        isPending={deleteMutation.isPending || statusMutation.isPending}
        onCancel={() => setConfirmation(null)}
        onConfirmComplete={() => setConfirmation(null)}
      />
    </>
  );
}

function ProductFilterForm({
  brands,
  categories,
  filters,
  isLoading,
  onChange,
  onReset,
  onSubmit
}: {
  brands: AdminBrand[];
  categories: Array<AdminCategory & { depth: number }>;
  filters: ProductFilters;
  isLoading: boolean;
  onChange: (filters: ProductFilters) => void;
  onReset: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  function updateFilter<Key extends keyof ProductFilters>(
    key: Key,
    value: ProductFilters[Key]
  ) {
    onChange({
      ...filters,
      [key]: value
    });
  }

  return (
    <form className="productFilters" onSubmit={onSubmit}>
      <label>
        Search name or SKU
        <span className="searchInput">
          <Search aria-hidden size={16} />
          <input
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Forceps or FORCEPS-001"
            value={filters.search}
          />
        </span>
      </label>
      <label>
        Category
        <select
          disabled={isLoading}
          onChange={(event) => updateFilter("category", event.target.value)}
          value={filters.category}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {"  ".repeat(category.depth)}
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Brand
        <select
          disabled={isLoading}
          onChange={(event) => updateFilter("brand", event.target.value)}
          value={filters.brand}
        >
          <option value="">All brands</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select
          onChange={(event) =>
            updateFilter("status", event.target.value as ProductFilters["status"])
          }
          value={filters.status}
        >
          <option value="">All statuses</option>
          {PRODUCT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {formatStatus(status)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Sterile
        <BooleanSelect
          onChange={(value) => updateFilter("sterile", value)}
          value={filters.sterile}
        />
      </label>
      <label>
        Disposable
        <BooleanSelect
          onChange={(value) => updateFilter("disposable", value)}
          value={filters.disposable}
        />
      </label>
      <label>
        Expiry sensitive
        <BooleanSelect
          onChange={(value) => updateFilter("expirySensitive", value)}
          value={filters.expirySensitive}
        />
      </label>
      <label>
        Medical specialty
        <input
          onChange={(event) => updateFilter("medicalSpecialty", event.target.value)}
          placeholder="General Surgery"
          value={filters.medicalSpecialty}
        />
      </label>
      <div className="productFilterActions">
        <button className="primaryButton iconTextButton" type="submit">
          <Search aria-hidden size={16} />
          <span>Apply</span>
        </button>
        <button className="ghostButton" onClick={onReset} type="button">
          Reset
        </button>
      </div>
    </form>
  );
}

function ProductTable({
  canDelete,
  canUpdate,
  editingProductId,
  isMutating,
  onActivate,
  onDeactivate,
  onDelete,
  onEdit,
  products
}: {
  canDelete: boolean;
  canUpdate: boolean;
  editingProductId: string | null;
  isMutating: boolean;
  onActivate: (product: AdminProduct) => void;
  onDeactivate: (product: AdminProduct) => void;
  onDelete: (product: AdminProduct) => void;
  onEdit: (product: AdminProduct) => void;
  products: AdminProduct[];
}) {
  return (
    <div className="productTable" role="table">
      <div className="productTableHeader" role="row">
        <strong role="columnheader">Product</strong>
        <strong role="columnheader">SKU</strong>
        <strong role="columnheader">Category</strong>
        <strong role="columnheader">Brand</strong>
        <strong role="columnheader">Price</strong>
        <strong role="columnheader">Status</strong>
        <strong role="columnheader">Flags</strong>
        <strong role="columnheader">Actions</strong>
      </div>
      {products.map((product) => (
        <div
          className="productTableRow"
          data-active={editingProductId === product.id}
          key={product.id}
          role="row"
        >
          <span role="cell">
            <strong>{product.name}</strong>
            <em>{product.medicalSpecialty ?? "No specialty"}</em>
          </span>
          <span role="cell">{product.sku}</span>
          <span role="cell">{product.category.name}</span>
          <span role="cell">{product.brand.name}</span>
          <span role="cell">{currencyFormatter.format(product.sellingPrice)}</span>
          <span role="cell">
            <StatusBadge status={product.status} />
          </span>
          <span className="flagList" role="cell">
            {product.sterile ? <b>Sterile</b> : null}
            {product.disposable ? <b>Disposable</b> : null}
            {product.expirySensitive ? <b>Expiry</b> : null}
            {product.inStock ? <b>Stock</b> : null}
          </span>
          <span className="tableActions" role="cell">
            <button className="ghostButton" onClick={() => onEdit(product)} type="button">
              <Pencil aria-hidden size={16} />
              <span>Edit</span>
            </button>
            {canUpdate && product.status !== "ACTIVE" ? (
              <button
                className="ghostButton"
                disabled={isMutating}
                onClick={() => onActivate(product)}
                type="button"
              >
                <CheckCircle2 aria-hidden size={16} />
                <span>Activate</span>
              </button>
            ) : null}
            {canUpdate && product.status === "ACTIVE" ? (
              <button
                className="ghostButton"
                disabled={isMutating}
                onClick={() => onDeactivate(product)}
                type="button"
              >
                <Power aria-hidden size={16} />
                <span>Deactivate</span>
              </button>
            ) : null}
            {canDelete ? (
              <button
                className="dangerButton"
                disabled={isMutating}
                onClick={() => onDelete(product)}
                type="button"
              >
                <Trash2 aria-hidden size={16} />
                <span>Delete</span>
              </button>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  );
}

function ProductForm({
  brands,
  canSave,
  categories,
  editingProduct,
  isLookupLoading,
  isSaving,
  onSave,
  onUploadError
}: {
  brands: AdminBrand[];
  canSave: boolean;
  categories: Array<AdminCategory & { depth: number }>;
  editingProduct: AdminProduct | null;
  isLookupLoading: boolean;
  isSaving: boolean;
  onSave: (values: ProductFormValues) => Promise<void>;
  onUploadError: (message: string | null) => void;
}) {
  const form = useForm<ProductFormValues>({
    defaultValues: createEmptyProductFormValues(),
    mode: "onSubmit",
    resolver: zodResolver(productFormSchema)
  });
  const imageFields = useFieldArray({
    control: form.control,
    name: "images"
  });
  const variantFields = useFieldArray({
    control: form.control,
    name: "variants"
  });
  const documentFields = useFieldArray({
    control: form.control,
    name: "documents"
  });
  const { api } = useAdminSession();
  const [uploadingImageIndex, setUploadingImageIndex] = useState<number | null>(null);
  const [uploadingDocumentIndex, setUploadingDocumentIndex] = useState<number | null>(null);
  const errors = form.formState.errors;

  useEffect(() => {
    form.reset(
      editingProduct ? productToFormValues(editingProduct) : createEmptyProductFormValues()
    );
  }, [editingProduct, form]);

  async function submit(values: ProductFormValues) {
    await onSave(values);
  }

  async function uploadImage(index: number, file: File | undefined) {
    if (!file) {
      return;
    }

    setUploadingImageIndex(index);
    onUploadError(null);
    try {
      const upload = await uploadFile(api.request, "/uploads/image", file, {
        entityId: editingProduct?.id,
        purpose: "product_image"
      });
      form.setValue(`images.${index}.url`, upload.url, {
        shouldDirty: true,
        shouldValidate: true
      });
      if (!form.getValues(`images.${index}.altText`)) {
        form.setValue(`images.${index}.altText`, editingProduct?.name ?? fileNameWithoutExtension(file.name), {
          shouldDirty: true
        });
      }
    } catch (error) {
      onUploadError(getErrorMessage(error) ?? "Image upload failed.");
    } finally {
      setUploadingImageIndex(null);
    }
  }

  async function uploadDocument(index: number, file: File | undefined) {
    if (!file) {
      return;
    }

    setUploadingDocumentIndex(index);
    onUploadError(null);
    try {
      const upload = await uploadFile(api.request, "/uploads/document", file, {
        entityId: editingProduct?.id,
        purpose: "product_document"
      });
      form.setValue(`documents.${index}.fileKey`, upload.key, {
        shouldDirty: true,
        shouldValidate: true
      });
      form.setValue(`documents.${index}.fileUrl`, upload.url, {
        shouldDirty: true,
        shouldValidate: true
      });
      if (!form.getValues(`documents.${index}.title`)) {
        form.setValue(`documents.${index}.title`, fileNameWithoutExtension(file.name), {
          shouldDirty: true,
          shouldValidate: true
        });
      }
    } catch (error) {
      onUploadError(getErrorMessage(error) ?? "Document upload failed.");
    } finally {
      setUploadingDocumentIndex(null);
    }
  }

  function generateSlug() {
    const nextSlug = slugifyProductName(form.getValues("name"));

    if (nextSlug) {
      form.setValue("slug", nextSlug, {
        shouldDirty: true,
        shouldValidate: true
      });
    }
  }

  return (
    <form className="formStack productForm" onSubmit={form.handleSubmit(submit)}>
      <div className="formSection">
        <h3>Core details</h3>
        <div className="formGrid">
          <TextField error={errors.name?.message} label="Name" registration={form.register("name")} />
          <div className="slugField">
            <TextField
              error={errors.slug?.message}
              label="Slug"
              registration={form.register("slug")}
            />
            <button className="ghostButton" onClick={generateSlug} type="button">
              Generate
            </button>
          </div>
          <TextField error={errors.sku?.message} label="SKU" registration={form.register("sku")} />
          <SelectField
            disabled={isLookupLoading}
            error={errors.brandId?.message}
            label="Brand"
            registration={form.register("brandId")}
          >
            <option value="">Select brand</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            disabled={isLookupLoading}
            error={errors.categoryId?.message}
            label="Category"
            registration={form.register("categoryId")}
          >
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {"  ".repeat(category.depth)}
                {category.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            error={errors.status?.message}
            label="Status"
            registration={form.register("status")}
          >
            {PRODUCT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </SelectField>
        </div>
        <TextAreaField
          error={errors.shortDescription?.message}
          label="Short description"
          registration={form.register("shortDescription")}
        />
        <TextAreaField
          error={errors.description?.message}
          label="Description"
          registration={form.register("description")}
        />
      </div>

      <div className="formSection">
        <h3>Pricing and classification</h3>
        <div className="formGrid">
          <TextField
            error={errors.basePrice?.message}
            inputMode="decimal"
            label="Base price"
            registration={form.register("basePrice")}
          />
          <TextField
            error={errors.sellingPrice?.message}
            inputMode="decimal"
            label="Selling price"
            registration={form.register("sellingPrice")}
          />
          <TextField
            error={errors.mrp?.message}
            inputMode="decimal"
            label="MRP"
            registration={form.register("mrp")}
          />
          <TextField
            error={errors.taxRate?.message}
            inputMode="decimal"
            label="Tax rate"
            registration={form.register("taxRate")}
          />
          <TextField error={errors.unit?.message} label="Unit" registration={form.register("unit")} />
          <TextField
            error={errors.packSize?.message}
            label="Pack size"
            registration={form.register("packSize")}
          />
          <TextField
            error={errors.material?.message}
            label="Material"
            registration={form.register("material")}
          />
          <TextField
            error={errors.medicalSpecialty?.message}
            label="Medical specialty"
            registration={form.register("medicalSpecialty")}
          />
        </div>
        <div className="toggleGrid">
          <label className="checkField">
            <input type="checkbox" {...form.register("expirySensitive")} />
            <span>Expiry sensitive</span>
          </label>
          <label className="checkField">
            <input type="checkbox" {...form.register("sterile")} />
            <span>Sterile</span>
          </label>
          <label className="checkField">
            <input type="checkbox" {...form.register("disposable")} />
            <span>Disposable</span>
          </label>
        </div>
      </div>

      <div className="formSection">
        <h3>SEO and search</h3>
        <div className="formGrid">
          <TextField
            error={errors.metaTitle?.message}
            label="Meta title"
            registration={form.register("metaTitle")}
          />
          <TextField
            error={errors.searchTags?.message}
            label="Search tags"
            placeholder="forceps, artery, reusable"
            registration={form.register("searchTags")}
          />
        </div>
        <TextAreaField
          error={errors.metaDescription?.message}
          label="Meta description"
          registration={form.register("metaDescription")}
        />
      </div>

      <ImageFields
        errors={errors}
        fields={imageFields.fields}
        form={form}
        onAdd={() => imageFields.append(createEmptyImageFormValue())}
        onRemove={imageFields.remove}
        onUpload={(index, file) => void uploadImage(index, file)}
        uploadingIndex={uploadingImageIndex}
      />

      <VariantFields
        errors={errors}
        fields={variantFields.fields}
        form={form}
        onAdd={() => variantFields.append(createEmptyVariantFormValue())}
        onRemove={variantFields.remove}
      />

      <DocumentFields
        errors={errors}
        fields={documentFields.fields}
        form={form}
        onAdd={() => documentFields.append(createEmptyDocumentFormValue())}
        onRemove={documentFields.remove}
        onUpload={(index, file) => void uploadDocument(index, file)}
        uploadingIndex={uploadingDocumentIndex}
      />

      <div className="actionRow">
        <button
          className="primaryButton iconTextButton"
          disabled={!canSave || isSaving}
          type="submit"
        >
          <CheckCircle2 aria-hidden size={16} />
          <span>{isSaving ? "Saving..." : editingProduct ? "Save changes" : "Create product"}</span>
        </button>
        {!canSave ? <span className="helperText">Your role cannot save product changes.</span> : null}
      </div>
    </form>
  );
}

function ImageFields({
  errors,
  fields,
  form,
  onAdd,
  onRemove,
  onUpload,
  uploadingIndex
}: {
  errors: FieldErrors<ProductFormValues>;
  fields: Array<{ id: string }>;
  form: UseFormReturn<ProductFormValues>;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpload: (index: number, file: File | undefined) => void;
  uploadingIndex: number | null;
}) {
  return (
    <div className="formSection">
      <div className="sectionTitleRow">
        <h3>Product images</h3>
        <button className="ghostButton iconTextButton" onClick={onAdd} type="button">
          <Plus aria-hidden size={16} />
          <span>Add image</span>
        </button>
      </div>
      {typeof errors.images?.message === "string" ? (
        <p className="fieldError">{errors.images.message}</p>
      ) : null}
      {fields.length === 0 ? <div className="emptyPanel smallEmpty">No images added.</div> : null}
      {fields.map((field, index) => (
        <div className="assetRow" key={field.id}>
          <TextField
            error={errors.images?.[index]?.url?.message}
            label="Image URL"
            registration={form.register(`images.${index}.url` as const)}
          />
          <TextField
            error={errors.images?.[index]?.altText?.message}
            label="Alt text"
            registration={form.register(`images.${index}.altText` as const)}
          />
          <TextField
            error={errors.images?.[index]?.sortOrder?.message}
            inputMode="numeric"
            label="Sort order"
            registration={form.register(`images.${index}.sortOrder` as const)}
          />
          <label className="checkField rowCheck">
            <input
              type="checkbox"
              {...form.register(`images.${index}.isPrimary` as const, {
                onChange: (event) => {
                  if ((event.target as HTMLInputElement).checked) {
                    form.getValues("images").forEach((_image, imageIndex) => {
                      if (imageIndex !== index) {
                        form.setValue(`images.${imageIndex}.isPrimary`, false, {
                          shouldDirty: true,
                          shouldValidate: true
                        });
                      }
                    });
                  }
                }
              })}
            />
            <span>Primary</span>
          </label>
          <label className="fileUploadButton">
            <ImageUp aria-hidden size={16} />
            <span>{uploadingIndex === index ? "Uploading..." : "Upload"}</span>
            <input
              accept="image/*"
              disabled={uploadingIndex !== null}
              onChange={(event) => onUpload(index, event.target.files?.[0])}
              type="file"
            />
          </label>
          <button className="ghostButton iconOnlyButton" onClick={() => onRemove(index)} type="button">
            <Trash2 aria-hidden size={16} />
            <span>Remove image</span>
          </button>
        </div>
      ))}
    </div>
  );
}

function VariantFields({
  errors,
  fields,
  form,
  onAdd,
  onRemove
}: {
  errors: FieldErrors<ProductFormValues>;
  fields: Array<{ id: string }>;
  form: UseFormReturn<ProductFormValues>;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="formSection">
      <div className="sectionTitleRow">
        <h3>Product variants</h3>
        <button className="ghostButton iconTextButton" onClick={onAdd} type="button">
          <Plus aria-hidden size={16} />
          <span>Add variant</span>
        </button>
      </div>
      {fields.length === 0 ? <div className="emptyPanel smallEmpty">No variants added.</div> : null}
      {fields.map((field, index) => (
        <div className="variantRow" key={field.id}>
          <TextField
            error={errors.variants?.[index]?.name?.message}
            label="Variant name"
            registration={form.register(`variants.${index}.name` as const)}
          />
          <TextField
            error={errors.variants?.[index]?.sku?.message}
            label="Variant SKU"
            registration={form.register(`variants.${index}.sku` as const)}
          />
          <TextField
            error={errors.variants?.[index]?.sellingPrice?.message}
            inputMode="decimal"
            label="Selling price"
            registration={form.register(`variants.${index}.sellingPrice` as const)}
          />
          <TextField
            error={errors.variants?.[index]?.mrp?.message}
            inputMode="decimal"
            label="MRP"
            registration={form.register(`variants.${index}.mrp` as const)}
          />
          <SelectField
            error={errors.variants?.[index]?.status?.message}
            label="Status"
            registration={form.register(`variants.${index}.status` as const)}
          >
            {PRODUCT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </SelectField>
          <TextAreaField
            error={errors.variants?.[index]?.attributesText?.message}
            label="Attributes JSON"
            registration={form.register(`variants.${index}.attributesText` as const)}
          />
          <button className="ghostButton iconTextButton" onClick={() => onRemove(index)} type="button">
            <Trash2 aria-hidden size={16} />
            <span>Remove variant</span>
          </button>
        </div>
      ))}
    </div>
  );
}

function DocumentFields({
  errors,
  fields,
  form,
  onAdd,
  onRemove,
  onUpload,
  uploadingIndex
}: {
  errors: FieldErrors<ProductFormValues>;
  fields: Array<{ id: string }>;
  form: UseFormReturn<ProductFormValues>;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpload: (index: number, file: File | undefined) => void;
  uploadingIndex: number | null;
}) {
  return (
    <div className="formSection">
      <div className="sectionTitleRow">
        <h3>Product documents</h3>
        <button className="ghostButton iconTextButton" onClick={onAdd} type="button">
          <Plus aria-hidden size={16} />
          <span>Add document</span>
        </button>
      </div>
      {fields.length === 0 ? (
        <div className="emptyPanel smallEmpty">No documents added.</div>
      ) : null}
      {fields.map((field, index) => (
        <div className="documentRow" key={field.id}>
          <TextField
            error={errors.documents?.[index]?.title?.message}
            label="Title"
            registration={form.register(`documents.${index}.title` as const)}
          />
          <SelectField
            error={errors.documents?.[index]?.type?.message}
            label="Type"
            registration={form.register(`documents.${index}.type` as const)}
          >
            {PRODUCT_DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatStatus(type)}
              </option>
            ))}
          </SelectField>
          <TextField
            error={errors.documents?.[index]?.fileKey?.message}
            label="File key"
            registration={form.register(`documents.${index}.fileKey` as const)}
          />
          <TextField
            error={errors.documents?.[index]?.fileUrl?.message}
            label="File URL"
            registration={form.register(`documents.${index}.fileUrl` as const)}
          />
          <label className="fileUploadButton">
            <FileUp aria-hidden size={16} />
            <span>{uploadingIndex === index ? "Uploading..." : "Upload"}</span>
            <input
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,image/*"
              disabled={uploadingIndex !== null}
              onChange={(event) => onUpload(index, event.target.files?.[0])}
              type="file"
            />
          </label>
          <button className="ghostButton iconOnlyButton" onClick={() => onRemove(index)} type="button">
            <Trash2 aria-hidden size={16} />
            <span>Remove document</span>
          </button>
        </div>
      ))}
    </div>
  );
}

function ConfirmationDialog({
  confirmation,
  isPending,
  onCancel,
  onConfirmComplete
}: {
  confirmation: ConfirmationState | null;
  isPending: boolean;
  onCancel: () => void;
  onConfirmComplete: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [confirmation]);

  if (!confirmation) {
    return null;
  }

  async function confirm() {
    if (!confirmation) {
      return;
    }

    try {
      setError(null);
      await confirmation.onConfirm();
      onConfirmComplete();
    } catch (actionError) {
      setError(getErrorMessage(actionError) ?? "Action failed.");
    }
  }

  return (
    <div className="dialogBackdrop" role="presentation">
      <div aria-modal="true" className="confirmationDialog" role="dialog">
        <h2>{confirmation.title}</h2>
        <p>{confirmation.body}</p>
        {error ? (
          <p className="formError" role="alert">
            {error}
          </p>
        ) : null}
        <div className="actionRow">
          <button className="dangerButton" disabled={isPending} onClick={() => void confirm()} type="button">
            {isPending ? "Working..." : confirmation.confirmLabel}
          </button>
          <button className="ghostButton" disabled={isPending} onClick={onCancel} type="button">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function TextField({
  error,
  inputMode,
  label,
  placeholder,
  registration
}: {
  error?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  label: string;
  placeholder?: string;
  registration: ReturnType<UseFormReturn<ProductFormValues>["register"]>;
}) {
  return (
    <label>
      {label}
      <input inputMode={inputMode} placeholder={placeholder} {...registration} />
      {error ? <span className="fieldError">{error}</span> : null}
    </label>
  );
}

function TextAreaField({
  error,
  label,
  registration
}: {
  error?: string;
  label: string;
  registration: ReturnType<UseFormReturn<ProductFormValues>["register"]>;
}) {
  return (
    <label>
      {label}
      <textarea {...registration} />
      {error ? <span className="fieldError">{error}</span> : null}
    </label>
  );
}

function SelectField({
  children,
  disabled,
  error,
  label,
  registration
}: {
  children: React.ReactNode;
  disabled?: boolean;
  error?: string;
  label: string;
  registration: ReturnType<UseFormReturn<ProductFormValues>["register"]>;
}) {
  return (
    <label>
      {label}
      <select disabled={disabled} {...registration}>
        {children}
      </select>
      {error ? <span className="fieldError">{error}</span> : null}
    </label>
  );
}

function BooleanSelect({
  onChange,
  value
}: {
  onChange: (value: BooleanFilter) => void;
  value: BooleanFilter;
}) {
  return (
    <select
      onChange={(event) => onChange(event.target.value as BooleanFilter)}
      value={value}
    >
      <option value="">Any</option>
      <option value="true">Yes</option>
      <option value="false">No</option>
    </select>
  );
}

function StatusBadge({ status }: { status: ProductStatus }) {
  return <span className={`statusBadge statusBadge--${status.toLowerCase()}`}>{formatStatus(status)}</span>;
}

function buildProductQuery(filters: ProductFilters, page: number) {
  return {
    brand: filters.brand || undefined,
    category: filters.category || undefined,
    disposable: toOptionalBoolean(filters.disposable),
    expirySensitive: toOptionalBoolean(filters.expirySensitive),
    limit: 20,
    medicalSpecialty: filters.medicalSpecialty || undefined,
    page,
    search: filters.search || undefined,
    status: filters.status || undefined,
    sterile: toOptionalBoolean(filters.sterile)
  };
}

function toOptionalBoolean(value: BooleanFilter) {
  if (value === "") {
    return undefined;
  }

  return value === "true";
}

async function uploadFile(
  request: <T>(
    path: string,
    init?: {
      body?: BodyInit | null;
      method?: string;
    }
  ) => Promise<T>,
  path: string,
  file: File,
  metadata: {
    entityId?: string;
    purpose: string;
  }
) {
  const body = new FormData();
  body.append("file", file);
  body.append("purpose", metadata.purpose);

  if (metadata.entityId) {
    body.append("entityId", metadata.entityId);
  }

  return request<UploadResponse>(path, {
    body,
    method: "POST"
  });
}

function fileNameWithoutExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "");
}

function formatStatus(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}
