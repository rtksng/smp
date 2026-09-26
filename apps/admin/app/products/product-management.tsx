"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode
} from "@lexical/list";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import {
  $createHeadingNode,
  HeadingNode,
  type HeadingTagType
} from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  CheckCircle2,
  FileUp,
  ImageUp,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Maximize2,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  Underline,
  X
} from "lucide-react";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  type EditorState,
  type ElementFormatType,
  type LexicalEditor,
  type TextFormatType
} from "lexical";
import Image, { type ImageLoaderProps } from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition
} from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  type FieldErrors,
  type UseFormReturn
} from "react-hook-form";
import {
  ConfirmationDialog,
  type ConfirmationState
} from "@/components/admin/confirmation-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { FilterDrawer } from "@/components/admin/filter-drawer";
import { FileUploadButton } from "@/components/admin/file-upload-button";
import { LoadingState } from "@/components/admin/loading-state";
import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { StatusBadge } from "@/components/admin/status-badge";
import { Badge } from "@/components/ui/badge";
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
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger
} from "@/components/ui/dropdown";
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
import { AdminShell } from "../admin-shell";
import { BulkPageCheckbox, BulkRowCheckbox } from "@/components/admin/bulk-actions";
import { ProductBulkActions } from "@/components/admin/product-bulk-actions";
import { loadBulkRows } from "@/lib/bulk-actions";
import { resolveAdminUploadUrl } from "@/lib/upload-url";
import { useBulkSelection, type BulkSelection } from "@/lib/use-bulk-selection";
import {
  DEFAULT_PRODUCT_PAGE_SIZE,
  getProductPrefetchServerPages,
  getProductVirtualWindow,
  isProductPageSize,
  loadProductPage,
  PRODUCT_PAGE_SIZE_OPTIONS,
  PRODUCT_PAGE_STALE_TIME,
  PRODUCT_SERVER_PAGE_SIZE,
  type ProductPageSize
} from "@/lib/product-pagination";
import { ProtectedRoute, useAdminSession } from "../../lib/admin-session";
import { ADMIN_PERMISSION } from "../../lib/permissions";
import {
  PRODUCT_DOCUMENT_TYPES,
  PRODUCT_CREATE_PATH,
  PRODUCT_LIST_PATH,
  PRODUCT_STATUSES,
  buildProductEditPath,
  buildProductPayload,
  createEmptyDocumentFormValue,
  createEmptyImageFormValue,
  createEmptyProductFormValues,
  createEmptyVariantFormValue,
  getSubcategoriesForCategory,
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
import styles from "./product-management.module.css";

type BooleanFilter = "" | "false" | "true";
type ProductView = "create" | "edit" | "list";

type ProductFilters = {
  brand: string;
  category: string;
  disposable: BooleanFilter;
  expirySensitive: BooleanFilter;
  medicalSpecialty: string;
  search: string;
  status: "" | ProductStatus;
  sterile: BooleanFilter;
  subcategory: string;
};

type UploadResponse = {
  key: string;
  mimeType: string;
  size: number;
  url: string;
};

const emptyFilters: ProductFilters = {
  brand: "",
  category: "",
  disposable: "",
  expirySensitive: "",
  medicalSpecialty: "",
  search: "",
  status: "",
  sterile: "",
  subcategory: ""
};

const FILTER_ALL_VALUE = "__all_filter_values__";
const BOOLEAN_FILTER_ANY_VALUE = "__any_boolean_filter__";
const FORM_SELECT_EMPTY_VALUE = "__empty_form_select__";
const RICH_TEXT_FORMAT_VALUE = "__rich_text_format__";
const MAX_PRODUCT_IMAGES = 20;

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 2,
  style: "currency"
});

const richTextEditorTheme = {
  heading: {
    h1: "richTextHeading richTextHeading1",
    h2: "richTextHeading richTextHeading2",
    h3: "richTextHeading richTextHeading3",
    h4: "richTextHeading richTextHeading4"
  },
  link: "richTextLink",
  list: {
    listitem: "richTextListItem",
    nested: {
      listitem: "richTextNestedListItem"
    },
    ol: "richTextList richTextOrderedList",
    ul: "richTextList richTextUnorderedList"
  },
  paragraph: "richTextParagraph",
  text: {
    bold: "richTextBold",
    italic: "richTextItalic",
    underline: "richTextUnderline"
  }
};

export function ProductManagementPage({
  productId = null,
  view
}: {
  productId?: string | null;
  view: ProductView;
}) {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.ProductsRead}>
        <ProductManagementContent productId={productId} view={view} />
      </ProtectedRoute>
    </AdminShell>
  );
}

function ProductManagementContent({
  productId,
  view
}: {
  productId: string | null;
  view: ProductView;
}) {
  const { api, hasPermission } = useAdminSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [draftFilters, setDraftFilters] = useState<ProductFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<ProductFilters>(emptyFilters);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<ProductPageSize>(DEFAULT_PRODUCT_PAGE_SIZE);
  const [isPaginationPending, startPaginationTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const appliedProductQuery = useMemo(
    () => buildProductQuery(appliedFilters),
    [appliedFilters]
  );
  const loadProductServerPage = useCallback(
    (serverPage: number) =>
      queryClient.fetchQuery<ProductListResponse>({
        queryFn: ({ signal }) =>
          api.request<ProductListResponse>("/admin/products", {
            query: {
              ...appliedProductQuery,
              limit: PRODUCT_SERVER_PAGE_SIZE,
              page: serverPage
            },
            signal
          }),
        queryKey: ["admin", "products", "server-page", appliedProductQuery, serverPage],
        staleTime: PRODUCT_PAGE_STALE_TIME
      }),
    [api, appliedProductQuery, queryClient]
  );

  const productsQuery = useQuery<ProductListResponse>({
    enabled: view === "list",
    placeholderData: (previousData) => previousData,
    queryFn: () =>
      loadProductPage({
        page,
        pageSize,
        query: appliedProductQuery,
        request: (query) => loadProductServerPage(Number(query.page))
      }),
    queryKey: ["admin", "products", appliedFilters, page, pageSize],
    staleTime: PRODUCT_PAGE_STALE_TIME
  });

  useEffect(() => {
    const total = productsQuery.data?.pagination.total;

    if (view !== "list" || productsQuery.isPlaceholderData || total === undefined) {
      return;
    }

    const serverPages = getProductPrefetchServerPages({ page, pageSize, total });
    void Promise.allSettled(serverPages.map(loadProductServerPage));
  }, [
    loadProductServerPage,
    page,
    pageSize,
    productsQuery.data?.pagination.total,
    productsQuery.isPlaceholderData,
    view
  ]);
  const productQuery = useQuery({
    enabled: view === "edit" && Boolean(productId),
    queryFn: () =>
      api.request<AdminProduct>(
        `/admin/products/${encodeURIComponent(productId ?? "")}`
      ),
    queryKey: ["admin", "products", "detail", productId]
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
      api.request<AdminProduct>(`/admin/products/${encodeURIComponent(id)}`, {
        body: JSON.stringify(payload),
        method: "PATCH"
      })
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.request<void>(`/admin/products/${encodeURIComponent(id)}`, {
        method: "DELETE"
      })
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProductStatus }) =>
      api.request<AdminProduct>(`/admin/products/${encodeURIComponent(id)}`, {
        body: JSON.stringify({ status }),
        method: "PATCH"
      })
  });

  const products = productsQuery.data?.items ?? [];
  const bulk = useBulkSelection(JSON.stringify(appliedFilters), products);
  const pagination = productsQuery.data?.pagination;
  const editingProduct = productQuery.data ?? null;
  const brands = brandsQuery.data ?? [];
  const categoryTree = categoriesQuery.data ?? [];
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
    getErrorMessage(statusMutation.error) ??
    uploadError;
  const editMissing =
    isEditView && !productQuery.isLoading && !productQuery.isError && !editingProduct;

  async function refreshProducts() {
    await queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
  }

  function handleFilterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters(draftFilters);
    setIsFilterDrawerOpen(false);
    setPage(1);
  }

  function resetFilters() {
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  }

  function handlePageChange(nextPage: number) {
    if (bulk.isBusy) {
      return;
    }

    startPaginationTransition(() => setPage(nextPage));
  }

  function handlePageSizeChange(nextPageSize: number) {
    if (!isProductPageSize(nextPageSize)) {
      return;
    }

    startPaginationTransition(() => {
      setPage(1);
      setPageSize(nextPageSize);
    });
  }

  async function handleSave(values: ProductFormValues) {
    setMessage(null);
    setUploadError(null);
    const payload = buildProductPayload(values);

    try {
      if (isEditView) {
        if (!productId) {
          setUploadError("Product ID is missing.");
          return;
        }

        await updateMutation.mutateAsync({ id: productId, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }

      await refreshProducts();
      router.push(PRODUCT_LIST_PATH);
    } catch {
      // React Query exposes the request error through mutationError above.
      return;
    }
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
    await statusMutation.mutateAsync({
      id: product.id,
      status
    });

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
        setMessage("Product soft deleted.");
        await refreshProducts();
      },
      title: "Soft delete product"
    });
  }

  if (isFormView) {
    return (
      <>
        <Card
          className={`panel ${styles.productFormPanel}`}
          data-product-layout="responsive"
          data-product-view={isEditView ? "edit" : "create"}
        >
          <PageHeader
            backHref={PRODUCT_LIST_PATH}
            eyebrow={isEditView ? "Edit product" : "New product"}
            summary={
              isEditView
                ? "Update catalog details, pricing, assets, variants, and lifecycle status."
                : "Create a catalog product with pricing, assets, variants, and documents."
            }
            title={
              isEditView ? (editingProduct?.name ?? "Edit product") : "Create product"
            }
          />

          {mutationError ? (
            <p className="formError" role="alert">
              {mutationError}
            </p>
          ) : null}
          {isEditView && productQuery.isLoading ? (
            <LoadingState label="Loading product..." />
          ) : null}
          {isEditView && productQuery.isError ? (
            <p className="formError" role="alert">
              {getErrorMessage(productQuery.error) ?? "Unable to load product."}
            </p>
          ) : null}
          {editMissing ? (
            <EmptyState
              body="This product was not found or is no longer available."
              title="Product unavailable"
            />
          ) : null}
          {!canCreate && view === "create" ? (
            <EmptyState
              body="Your role can view products but cannot create them."
              title="Create access unavailable"
            />
          ) : null}
          {!canUpdate && isEditView && editingProduct ? (
            <EmptyState
              body="Your role can view products but cannot edit them."
              title="Edit access unavailable"
            />
          ) : null}
          {view === "create" || editingProduct ? (
            <ProductForm
              brands={brands}
              canSave={canSave}
              categories={categoryTree}
              editingProduct={editingProduct}
              isLookupLoading={brandsQuery.isLoading || categoriesQuery.isLoading}
              isSaving={createMutation.isPending || updateMutation.isPending}
              onSave={handleSave}
              onUploadError={setUploadError}
            />
          ) : null}
        </Card>
      </>
    );
  }

  return (
    <>
      <Card className={`panel ${styles.productOverview}`} data-product-layout="responsive">
        <PageHeader
          actions={
            <>
              <Button
                className="iconTextButton"
                onClick={() => setIsFilterDrawerOpen(true)}
                type="button"
              >
                <SlidersHorizontal aria-hidden size={16} />
                <span>Add filter</span>
              </Button>
              <Button
                className="iconTextButton"
                onClick={() => void refreshProducts()}
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden size={16} />
                <span>Refresh</span>
              </Button>
              {canCreate ? (
                <Button asChild className="iconTextButton">
                  <Link href={PRODUCT_CREATE_PATH}>
                    <Plus aria-hidden size={16} />
                    <span>New product</span>
                  </Link>
                </Button>
              ) : null}
            </>
          }
          eyebrow="Products"
          summary="Search, filter, create, edit, upload assets, and manage product lifecycle."
          title="Product catalog management"
        />

        {message ? <p className="formSuccess">{message}</p> : null}
        {mutationError ? (
          <p className="formError" role="alert">
            {mutationError}
          </p>
        ) : null}

        <div
          aria-label="Product key metrics"
          className={`metricGrid resourceMetrics ${styles.kpiGrid}`}
          role="region"
        >
          <MetricCard
            label="Total products"
            tone="primary"
            value={pagination?.total ?? products.length}
          />
          <MetricCard label="Visible page" value={products.length} />
          <MetricCard
            label="Active"
            tone="warning"
            value={products.filter((product) => product.status === "ACTIVE").length}
          />
          <MetricCard
            label="In stock"
            value={products.filter((product) => product.inStock).length}
          />
        </div>
      </Card>

      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        isSubmitting={productsQuery.isFetching}
        onApply={handleFilterSubmit}
        onOpenChange={setIsFilterDrawerOpen}
        onReset={resetFilters}
        summary="Search and refine the product catalog table."
        title="Product filters"
      >
        <ProductFilterFields
          brands={brands}
          categories={categoryTree}
          filters={draftFilters}
          isLoading={brandsQuery.isLoading || categoriesQuery.isLoading}
          onChange={setDraftFilters}
        />
      </FilterDrawer>

      <Card className={`panel mt-3 ${styles.productTablePanel}`}>
        <PageHeader
          actions={
            pagination ? (
              <span>
                Page {pagination.page} of {Math.max(pagination.totalPages, 1)}
              </span>
            ) : null
          }
          level={2}
          eyebrow="Product list"
          title="Catalog table"
        />

        {productsQuery.isLoading ? <LoadingState label="Loading products..." /> : null}
        {canUpdate ? (
          <div className={styles.compactBulkActions}>
            <ProductBulkActions
              key={bulk.scope}
              selection={bulk}
              brands={brands}
              categories={categoryTree}
              total={pagination?.total ?? 0}
              disabled={
                productsQuery.isFetching ||
                productsQuery.isError ||
                deleteMutation.isPending ||
                statusMutation.isPending
              }
              loadAll={() =>
                loadBulkRows((next, limit) =>
                  api.request<ProductListResponse>("/admin/products", {
                    query: { ...buildProductQuery(appliedFilters), limit, page: next }
                  })
                )
              }
              onComplete={refreshProducts}
            />
          </div>
        ) : null}
        {productsQuery.isError ? (
          <p className="formError" role="alert">
            {getErrorMessage(productsQuery.error) ?? "Unable to load products."}
          </p>
        ) : null}
        {!productsQuery.isLoading && !productsQuery.isError ? (
          <ProductTable
            bulk={bulk}
            canDelete={canDelete}
            canUpdate={canUpdate}
            isMutating={
              bulk.isBusy || deleteMutation.isPending || statusMutation.isPending
            }
            key={`${bulk.scope}:${page}:${pageSize}`}
            onActivate={(product) => void updateProductStatus(product, "ACTIVE")}
            onDeactivate={requestDeactivate}
            onDelete={requestDelete}
            products={products}
          />
        ) : null}

        {pagination ? (
          <PaginationControls
            isPending={isPaginationPending || productsQuery.isFetching}
            itemLabel="Products per page"
            onChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            page={pagination.page}
            pageSize={pageSize}
            pageSizeOptions={PRODUCT_PAGE_SIZE_OPTIONS}
            totalItems={pagination.total}
            totalPages={pagination.totalPages}
          />
        ) : null}
      </Card>

      <ConfirmationDialog
        confirmation={confirmation}
        isPending={deleteMutation.isPending || statusMutation.isPending}
        onCancel={() => setConfirmation(null)}
        onConfirmComplete={() => setConfirmation(null)}
      />
    </>
  );
}

function ProductFilterFields({
  brands,
  categories,
  filters,
  isLoading,
  onChange
}: {
  brands: AdminBrand[];
  categories: AdminCategory[];
  filters: ProductFilters;
  isLoading: boolean;
  onChange: (filters: ProductFilters) => void;
}) {
  const subcategories = filters.category
    ? getSubcategoriesForCategory(categories, filters.category)
    : [];

  function updateFilter<Key extends keyof ProductFilters>(
    key: Key,
    value: ProductFilters[Key]
  ) {
    onChange({
      ...filters,
      [key]: value,
      ...(key === "category" ? { subcategory: "" } : {})
    });
  }

  return (
    <div className="filterDrawerFields">
      <Label>
        Search name or SKU
        <span className="searchInput">
          <Search aria-hidden size={16} />
          <Input
            className="filterDrawerControl"
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Forceps or FORCEPS-001"
            value={filters.search}
          />
        </span>
      </Label>
      <Label>
        Category
        <Select
          disabled={isLoading}
          onValueChange={(value) =>
            updateFilter("category", value === FILTER_ALL_VALUE ? "" : value)
          }
          value={filters.category || FILTER_ALL_VALUE}
        >
          <SelectTrigger className="filterDrawerControl">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTER_ALL_VALUE}>All categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Label>
      <Label>
        Subcategory
        <Select
          disabled={isLoading || !filters.category || subcategories.length === 0}
          onValueChange={(value) =>
            updateFilter("subcategory", value === FILTER_ALL_VALUE ? "" : value)
          }
          value={filters.subcategory || FILTER_ALL_VALUE}
        >
          <SelectTrigger className="filterDrawerControl">
            <SelectValue placeholder="All subcategories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTER_ALL_VALUE}>All subcategories</SelectItem>
            {subcategories.map((subcategory) => (
              <SelectItem key={subcategory.id} value={subcategory.id}>
                {subcategory.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Label>
      <Label>
        Brand
        <Select
          disabled={isLoading}
          onValueChange={(value) =>
            updateFilter("brand", value === FILTER_ALL_VALUE ? "" : value)
          }
          value={filters.brand || FILTER_ALL_VALUE}
        >
          <SelectTrigger className="filterDrawerControl">
            <SelectValue placeholder="All brands" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTER_ALL_VALUE}>All brands</SelectItem>
            {brands.map((brand) => (
              <SelectItem key={brand.id} value={brand.id}>
                {brand.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Label>
      <Label>
        Status
        <Select
          onValueChange={(value) =>
            updateFilter(
              "status",
              value === FILTER_ALL_VALUE ? "" : (value as ProductStatus)
            )
          }
          value={filters.status || FILTER_ALL_VALUE}
        >
          <SelectTrigger className="filterDrawerControl">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTER_ALL_VALUE}>All statuses</SelectItem>
            {PRODUCT_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {formatStatus(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Label>
      <Label>
        Sterile
        <BooleanSelect
          onChange={(value) => updateFilter("sterile", value)}
          value={filters.sterile}
        />
      </Label>
      <Label>
        Disposable
        <BooleanSelect
          onChange={(value) => updateFilter("disposable", value)}
          value={filters.disposable}
        />
      </Label>
      <Label>
        Expiry sensitive
        <BooleanSelect
          onChange={(value) => updateFilter("expirySensitive", value)}
          value={filters.expirySensitive}
        />
      </Label>
      <Label>
        Medical specialty
        <Input
          className="filterDrawerControl"
          onChange={(event) => updateFilter("medicalSpecialty", event.target.value)}
          placeholder="General Surgery"
          value={filters.medicalSpecialty}
        />
      </Label>
    </div>
  );
}

function ProductTable({
  bulk,
  canDelete,
  canUpdate,
  isMutating,
  onActivate,
  onDeactivate,
  onDelete,
  products
}: {
  bulk: BulkSelection<AdminProduct>;
  canDelete: boolean;
  canUpdate: boolean;
  isMutating: boolean;
  onActivate: (product: AdminProduct) => void;
  onDeactivate: (product: AdminProduct) => void;
  onDelete: (product: AdminProduct) => void;
  products: AdminProduct[];
}) {
  const [virtualWindow, setVirtualWindow] = useState(() =>
    getProductVirtualWindow({ itemCount: products.length, scrollTop: 0 })
  );
  const scrollFrameRef = useRef<number | null>(null);
  const nextScrollTopRef = useRef(0);
  const visibleProducts = products.slice(virtualWindow.start, virtualWindow.end);
  const columnCount = canUpdate ? 9 : 8;

  useEffect(() => {
    setVirtualWindow(
      getProductVirtualWindow({ itemCount: products.length, scrollTop: 0 })
    );
  }, [products.length]);

  useEffect(
    () => () => {
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
      }
    },
    []
  );

  function handleTableScroll(event: React.UIEvent<HTMLDivElement>) {
    if (!virtualWindow.isVirtualized) {
      return;
    }

    nextScrollTopRef.current = event.currentTarget.scrollTop;
    if (scrollFrameRef.current !== null) {
      return;
    }

    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      const nextWindow = getProductVirtualWindow({
        itemCount: products.length,
        scrollTop: nextScrollTopRef.current
      });

      setVirtualWindow((currentWindow) =>
        currentWindow.start === nextWindow.start && currentWindow.end === nextWindow.end
          ? currentWindow
          : nextWindow
      );
    });
  }

  return (
    <div className={`brandTableScroll ${styles.tableShell}`}>
      <p className={styles.mobileTableHint} id="product-table-scroll-hint">
        Swipe horizontally to view every product detail and action.
      </p>
      <Table
        aria-describedby="product-table-scroll-hint"
        aria-rowcount={products.length + 1}
        className="brandDataTable productDataTable"
        containerClassName={styles.tableViewport}
        onContainerScroll={handleTableScroll}
      >
        <colgroup>
          {canUpdate ? <col className="bulkCheckboxColumn" /> : null}
          <col className="productTableProductColumn" />
          <col className="productTableSkuColumn" />
          <col className="productTableCategoryColumn" />
          <col className="productTableBrandColumn" />
          <col className="productTablePriceColumn" />
          <col className="productTableStatusColumn" />
          <col className="productTableFlagsColumn" />
          <col className="productTableActionsColumn" />
        </colgroup>
        <TableHeader>
          <TableRow>
            {canUpdate ? (
              <TableHead className="bulkCheckboxCell">
                <BulkPageCheckbox selection={bulk} />
              </TableHead>
            ) : null}
            <TableHead>Product</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Brand</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Flags</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columnCount}>
                No products match the selected filters.
              </TableCell>
            </TableRow>
          ) : (
            <>
              {virtualWindow.topSpacerHeight > 0 ? (
                <TableRow
                  aria-hidden="true"
                  className="productVirtualSpacer"
                  style={{ height: virtualWindow.topSpacerHeight }}
                >
                  <TableCell colSpan={columnCount} />
                </TableRow>
              ) : null}
              {visibleProducts.map((product, index) => (
                <TableRow
                  aria-rowindex={virtualWindow.start + index + 2}
                  className={
                    virtualWindow.isVirtualized ? "productVirtualizedRow" : undefined
                  }
                  key={product.id}
                >
                  {canUpdate ? (
                    <TableCell className="bulkCheckboxCell">
                      <BulkRowCheckbox
                        selection={bulk}
                        item={product}
                        label={product.name}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <strong>{product.name}</strong>
                    <span className="tableSubtext">
                      {product.medicalSpecialty ?? "No specialty"}
                    </span>
                  </TableCell>
                  <TableCell>{product.sku}</TableCell>
                  <TableCell>
                    {product.category.name}
                    {product.subcategory ? (
                      <span className="tableSubtext">{product.subcategory.name}</span>
                    ) : null}
                  </TableCell>
                  <TableCell>{product.brand.name}</TableCell>
                  <TableCell>
                    {currencyFormatter.format(product.sellingPrice)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={product.status} />
                  </TableCell>
                  <TableCell>
                    <span className="flagList">
                      {product.sterile ? (
                        <Badge variant="secondary">Sterile</Badge>
                      ) : null}
                      {product.disposable ? (
                        <Badge variant="secondary">Disposable</Badge>
                      ) : null}
                      {product.expirySensitive ? (
                        <Badge variant="secondary">Expiry</Badge>
                      ) : null}
                      {product.inStock ? (
                        <Badge variant="secondary">Stock</Badge>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Dropdown>
                      <DropdownTrigger>
                        <Button
                          aria-label={`Actions for ${product.name}`}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <MoreVertical aria-hidden size={16} />
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu aria-label={`Actions for ${product.name}`}>
                        {canUpdate ? (
                          <DropdownItem
                            key="edit"
                            as={Link}
                            href={buildProductEditPath(product.id)}
                          >
                            Edit
                          </DropdownItem>
                        ) : (
                          <DropdownItem key="edit-disabled" isDisabled>
                            Edit
                          </DropdownItem>
                        )}
                        {canUpdate && product.status !== "ACTIVE" ? (
                          <DropdownItem
                            key="activate"
                            isDisabled={isMutating}
                            onPress={() => onActivate(product)}
                          >
                            Activate
                          </DropdownItem>
                        ) : null}
                        {canUpdate && product.status === "ACTIVE" ? (
                          <DropdownItem
                            key="deactivate"
                            isDisabled={isMutating}
                            onPress={() => onDeactivate(product)}
                          >
                            Deactivate
                          </DropdownItem>
                        ) : null}
                        {canDelete ? (
                          <DropdownItem
                            key="delete"
                            className="text-danger"
                            color="danger"
                            isDisabled={isMutating}
                            onPress={() => onDelete(product)}
                          >
                            Delete
                          </DropdownItem>
                        ) : null}
                      </DropdownMenu>
                    </Dropdown>
                  </TableCell>
                </TableRow>
              ))}
              {virtualWindow.bottomSpacerHeight > 0 ? (
                <TableRow
                  aria-hidden="true"
                  className="productVirtualSpacer"
                  style={{ height: virtualWindow.bottomSpacerHeight }}
                >
                  <TableCell colSpan={columnCount} />
                </TableRow>
              ) : null}
            </>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function ProductForm({
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
  categories: AdminCategory[];
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
  const [imageUploadProgress, setImageUploadProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [uploadingDocumentIndex, setUploadingDocumentIndex] = useState<number | null>(
    null
  );
  const slugManuallyEditedRef = useRef(false);
  const errors = form.formState.errors;
  const nameValue = form.watch("name");
  const selectedCategoryId = form.watch("categoryId");
  const descriptionValue = form.watch("description");
  const slugValue = form.watch("slug");
  const subcategories = useMemo(
    () =>
      selectedCategoryId
        ? getSubcategoriesForCategory(categories, selectedCategoryId)
        : [],
    [categories, selectedCategoryId]
  );

  useEffect(() => {
    slugManuallyEditedRef.current = Boolean(editingProduct);
    form.reset(
      editingProduct
        ? productToFormValues(editingProduct)
        : createEmptyProductFormValues()
    );
  }, [editingProduct, form]);

  useEffect(() => {
    if (editingProduct || slugManuallyEditedRef.current) {
      return;
    }

    const nextSlug = slugifyProductName(nameValue);

    if (slugValue !== nextSlug) {
      form.setValue("slug", nextSlug, {
        shouldDirty: nextSlug !== "",
        shouldValidate: false
      });
    }
  }, [editingProduct, form, nameValue, slugValue]);

  useEffect(() => {
    if (isLookupLoading || selectedCategoryId !== form.getValues("categoryId")) {
      return;
    }

    const selectedSubcategoryId = form.getValues("subcategoryId");

    if (
      selectedSubcategoryId &&
      !subcategories.some((subcategory) => subcategory.id === selectedSubcategoryId)
    ) {
      form.setValue("subcategoryId", "", {
        shouldDirty: true,
        shouldValidate: true
      });
    }
  }, [form, isLookupLoading, selectedCategoryId, subcategories]);

  async function submit(values: ProductFormValues) {
    await onSave(values);
  }

  async function uploadImages(files: File[]) {
    if (files.length === 0) {
      return;
    }

    const existingImages = form.getValues("images");
    const availableSlots = Math.max(0, MAX_PRODUCT_IMAGES - existingImages.length);
    const selectedFiles = files.slice(0, availableSlots);
    const skippedCount = files.length - selectedFiles.length;

    if (selectedFiles.length === 0) {
      onUploadError(`A product can have up to ${MAX_PRODUCT_IMAGES} images.`);
      return;
    }

    setImageUploadProgress({ completed: 0, total: selectedFiles.length });
    onUploadError(null);

    try {
      const uploadResults = await Promise.allSettled(
        selectedFiles.map(async (file) => {
          try {
            const upload = await uploadFile(api.request, "/uploads/image", file, {
              entityId: editingProduct?.id,
              purpose: "product_image"
            });

            return { file, upload };
          } finally {
            setImageUploadProgress((progress) =>
              progress
                ? {
                    ...progress,
                    completed: progress.completed + 1
                  }
                : null
            );
          }
        })
      );
      const successfulUploads = uploadResults.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : []
      );
      const failedUploads = uploadResults.filter(
        (result) => result.status === "rejected"
      );

      if (successfulUploads.length > 0) {
        const hasPrimaryImage = existingImages.some(
          (image) => image.url !== "" && image.isPrimary
        );
        imageFields.append(
          successfulUploads.map(({ file, upload }, index) => ({
            altText: fileNameWithoutExtension(file.name),
            isPrimary: !hasPrimaryImage && index === 0,
            sortOrder: String(existingImages.length + index),
            url: upload.url
          }))
        );
      }

      if (failedUploads.length > 0 || skippedCount > 0) {
        const messages = [];

        if (failedUploads.length > 0) {
          messages.push(
            `${failedUploads.length} of ${selectedFiles.length} selected images could not be uploaded.`
          );
        }
        if (skippedCount > 0) {
          messages.push(
            `${skippedCount} image${skippedCount === 1 ? " was" : "s were"} skipped because a product can have up to ${MAX_PRODUCT_IMAGES} images.`
          );
        }

        onUploadError(messages.join(" "));
      }
    } finally {
      setImageUploadProgress(null);
    }
  }

  function removeImage(index: number) {
    const images = form.getValues("images");
    const removedImageWasPrimary = images[index]?.isPrimary === true;
    const remainingImages = images.filter((_image, imageIndex) => imageIndex !== index);

    if (
      removedImageWasPrimary &&
      remainingImages.length > 0 &&
      !remainingImages.some((image) => image.isPrimary)
    ) {
      const nextPrimaryIndex = remainingImages.findIndex((image) => image.url !== "");
      const nextPrimaryImage = remainingImages[nextPrimaryIndex];

      if (nextPrimaryIndex >= 0 && nextPrimaryImage) {
        remainingImages[nextPrimaryIndex] = {
          ...nextPrimaryImage,
          isPrimary: true
        };
      }
    }

    imageFields.replace(remainingImages);
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

    slugManuallyEditedRef.current = false;
    form.setValue("slug", nextSlug, {
      shouldDirty: true,
      shouldValidate: true
    });
  }

  return (
    <form
      className={`formStack productForm ${styles.productForm}`}
      onSubmit={form.handleSubmit(submit)}
    >
      <Card aria-label="Core product details" className="formSection border-0">
        <div className="formGrid">
          <TextField
            error={errors.name?.message}
            label="Name"
            registration={form.register("name")}
          />
          <div className="slugField">
            <Controller
              control={form.control}
              name="slug"
              render={({ field }) => (
                <Label>
                  Slug
                  <Input
                    name={field.name}
                    onBlur={field.onBlur}
                    onChange={(event) => {
                      slugManuallyEditedRef.current = true;
                      field.onChange(slugifyProductName(event.target.value));
                    }}
                    ref={field.ref}
                    value={field.value}
                  />
                  {errors.slug?.message ? (
                    <span className="fieldError">{errors.slug.message}</span>
                  ) : null}
                </Label>
              )}
            />
            <Button onClick={generateSlug} type="button" variant="outline">
              Generate
            </Button>
          </div>
          <TextField
            error={errors.sku?.message}
            label="SKU"
            registration={form.register("sku")}
          />
          <SelectField
            disabled={isLookupLoading}
            error={errors.brandId?.message}
            label="Brand"
            onChange={(value) =>
              form.setValue("brandId", value, {
                shouldDirty: true,
                shouldValidate: true
              })
            }
            options={brands.map((brand) => ({
              label: brand.name,
              value: brand.id
            }))}
            placeholder="Select brand"
            value={form.watch("brandId")}
          />
          <SelectField
            disabled={isLookupLoading}
            error={errors.categoryId?.message}
            label="Category"
            onChange={(value) =>
              form.setValue("categoryId", value, {
                shouldDirty: true,
                shouldValidate: true
              })
            }
            options={categories.map((category) => ({
              label: category.name,
              value: category.id
            }))}
            placeholder="Select category"
            value={form.watch("categoryId")}
          />
          <SelectField
            disabled={
              isLookupLoading || !selectedCategoryId || subcategories.length === 0
            }
            error={errors.subcategoryId?.message}
            label="Subcategory"
            onChange={(value) =>
              form.setValue("subcategoryId", value, {
                shouldDirty: true,
                shouldValidate: true
              })
            }
            options={subcategories.map((subcategory) => ({
              label: subcategory.name,
              value: subcategory.id
            }))}
            placeholder={
              subcategories.length > 0 ? "Select subcategory" : "No subcategory"
            }
            value={form.watch("subcategoryId")}
          />
          <SelectField
            error={errors.status?.message}
            label="Status"
            onChange={(value) =>
              form.setValue("status", value as ProductStatus, {
                shouldDirty: true,
                shouldValidate: true
              })
            }
            options={PRODUCT_STATUSES.map((status) => ({
              label: formatStatus(status),
              value: status
            }))}
            value={form.watch("status")}
          />
        </div>
        <TextAreaField
          error={errors.shortDescription?.message}
          label="Short description"
          registration={form.register("shortDescription")}
        />
        <RichTextEditorField
          error={errors.description?.message}
          label="Description"
          onChange={(value) =>
            form.setValue("description", value, {
              shouldDirty: true,
              shouldValidate: true
            })
          }
          value={descriptionValue}
        />
      </Card>

      <Card className="formSection border-0">
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
          <TextField
            error={errors.unit?.message}
            label="Unit"
            registration={form.register("unit")}
          />
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
          <Label className="checkField">
            <Checkbox
              checked={form.watch("expirySensitive")}
              onCheckedChange={(checked) =>
                form.setValue("expirySensitive", checked === true, {
                  shouldDirty: true,
                  shouldValidate: true
                })
              }
            />
            <span>Expiry sensitive</span>
          </Label>
          <Label className="checkField">
            <Checkbox
              checked={form.watch("sterile")}
              onCheckedChange={(checked) =>
                form.setValue("sterile", checked === true, {
                  shouldDirty: true,
                  shouldValidate: true
                })
              }
            />
            <span>Sterile</span>
          </Label>
          <Label className="checkField">
            <Checkbox
              checked={form.watch("disposable")}
              onCheckedChange={(checked) =>
                form.setValue("disposable", checked === true, {
                  shouldDirty: true,
                  shouldValidate: true
                })
              }
            />
            <span>Disposable</span>
          </Label>
        </div>
      </Card>

      <Card className="formSection border-0">
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
      </Card>

      <ImageFields
        errors={errors}
        fields={imageFields.fields}
        form={form}
        onAdd={() => imageFields.append(createEmptyImageFormValue())}
        onRemove={removeImage}
        onUpload={(files) => void uploadImages(files)}
        uploadProgress={imageUploadProgress}
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
        <Button
          className="iconTextButton"
          disabled={!canSave || isSaving}
          type="submit"
        >
          <CheckCircle2 aria-hidden size={16} />
          <span>
            {isSaving ? "Saving..." : editingProduct ? "Save changes" : "Save product"}
          </span>
        </Button>
        {!canSave ? (
          <span className="helperText">Your role cannot save product changes.</span>
        ) : null}
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
  uploadProgress
}: {
  errors: FieldErrors<ProductFormValues>;
  fields: Array<{ id: string }>;
  form: UseFormReturn<ProductFormValues>;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpload: (files: File[]) => void;
  uploadProgress: { completed: number; total: number } | null;
}) {
  const images = form.watch("images");
  const isUploading = uploadProgress !== null;
  const [expandedImage, setExpandedImage] = useState<{
    name: string;
    url: string;
  } | null>(null);

  function setMainImage(selectedIndex: number) {
    images.forEach((_image, imageIndex) => {
      form.setValue(`images.${imageIndex}.isPrimary`, imageIndex === selectedIndex, {
        shouldDirty: true,
        shouldValidate: true
      });
    });
  }

  return (
    <Card className="formSection imageGallerySection border-0">
      <div className="sectionTitleRow">
        <div className="imageGalleryHeading">
          <h3>Product image gallery</h3>
          <span className="helperText">
            {fields.length} of {MAX_PRODUCT_IMAGES} images
          </span>
        </div>
        <Button
          className="iconTextButton"
          disabled={isUploading || fields.length >= MAX_PRODUCT_IMAGES}
          onClick={onAdd}
          type="button"
          variant="outline"
        >
          <Plus aria-hidden size={16} />
          <span>Add by URL</span>
        </Button>
      </div>

      <div className="imageGalleryUploader">
        <div className="imageGalleryUploadCopy">
          <strong>Add product photos</strong>
          <span>
            Select several JPG, PNG, WebP, or AVIF images in one go. The first image
            becomes the main image automatically.
          </span>
        </div>
        <FileUploadButton
          className="imageGalleryUploadButton"
          inputProps={{
            accept: "image/avif,image/jpeg,image/png,image/webp",
            "aria-label": "Upload product images",
            disabled: isUploading || fields.length >= MAX_PRODUCT_IMAGES,
            multiple: true,
            onChange: (event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              onUpload(files);
            }
          }}
        >
          <ImageUp aria-hidden size={18} />
          <span>
            {uploadProgress
              ? `Uploading ${uploadProgress.completed} of ${uploadProgress.total}`
              : "Choose images"}
          </span>
        </FileUploadButton>
      </div>

      <p className="imageGalleryStatus helperText" role="status">
        {isUploading
          ? "Keep this page open while the selected images are uploaded."
          : "Use Set as main to choose the image shown first across the catalog."}
      </p>

      {typeof errors.images?.message === "string" ? (
        <p className="fieldError">{errors.images.message}</p>
      ) : null}
      {fields.length === 0 ? (
        <div className="emptyPanel imageGalleryEmpty">
          <ImageUp aria-hidden size={24} />
          <strong>No product images yet</strong>
          <span>Choose one or more images to build the product gallery.</span>
        </div>
      ) : (
        <div className="imageGalleryGrid">
          {fields.map((field, index) => {
            const image = images[index] ?? createEmptyImageFormValue();
            const imageName = image.altText.trim() || `Product image ${index + 1}`;
            const previewUrl = resolveAdminUploadUrl(image.url);

            return (
              <article
                className={`imageGalleryCard${image.isPrimary ? " imageGalleryCardMain" : ""}`}
                key={field.id}
              >
                <div className="imageGalleryPreview">
                  {isPreviewableImageUrl(previewUrl) ? (
                    <Image
                      alt={imageName}
                      fill
                      loader={passthroughImageLoader}
                      sizes="(max-width: 640px) 100vw, (max-width: 1040px) 50vw, 25vw"
                      src={previewUrl}
                      unoptimized
                    />
                  ) : (
                    <div className="imageGalleryPlaceholder">
                      <ImageUp aria-hidden size={24} />
                      <span>Add an image URL</span>
                    </div>
                  )}
                  {image.isPrimary ? (
                    <Badge className="imageGalleryMainBadge">Main image</Badge>
                  ) : null}
                  <div className="imageGalleryPreviewActions">
                    {isPreviewableImageUrl(previewUrl) ? (
                      <Button
                        aria-label={`Expand ${imageName}`}
                        className="imageGalleryExpandButton"
                        size="icon"
                        onClick={() =>
                          setExpandedImage({ name: imageName, url: previewUrl })
                        }
                        title={`Expand ${imageName}`}
                        type="button"
                        variant="outline"
                      >
                        <Maximize2 aria-hidden size={14} />
                      </Button>
                    ) : null}
                    <Button
                      aria-label={`Remove ${imageName}`}
                      className="imageGalleryRemoveButton"
                      size="icon"
                      onClick={() => onRemove(index)}
                      title={`Remove ${imageName}`}
                      type="button"
                      variant="outline"
                    >
                      <X aria-hidden size={14} />
                    </Button>
                  </div>
                </div>

                <div className="imageGalleryCardBody">
                  <div className="imageGalleryCardTitle">
                    <strong>{imageName}</strong>
                    <span>
                      {image.isPrimary ? "Catalog cover" : `Image ${index + 1}`}
                    </span>
                  </div>
                  {!image.isPrimary ? (
                    <Button
                      aria-label={`Set ${imageName} as main image`}
                      className="imageGalleryMainButton"
                      disabled={!isPreviewableImageUrl(image.url)}
                      onClick={() => setMainImage(index)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Set as main
                    </Button>
                  ) : null}
                </div>

                <details className="imageGalleryDetails">
                  <summary>Image details</summary>
                  <div className="imageGalleryDetailFields">
                    <Controller
                      control={form.control}
                      name={`images.${index}.url` as const}
                      render={({ field: imageUrlField }) => (
                        <Label>
                          Image URL
                          <Input
                            aria-label={`Image URL ${index + 1}`}
                            name={imageUrlField.name}
                            onBlur={imageUrlField.onBlur}
                            onChange={imageUrlField.onChange}
                            ref={imageUrlField.ref}
                            value={imageUrlField.value}
                          />
                          {errors.images?.[index]?.url?.message ? (
                            <span className="fieldError">
                              {errors.images[index]?.url?.message}
                            </span>
                          ) : null}
                        </Label>
                      )}
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
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      )}

      <Dialog
        open={expandedImage !== null}
        onOpenChange={(open) => {
          if (!open) {
            setExpandedImage(null);
          }
        }}
      >
        <DialogContent className="imageGalleryPreviewDialog">
          <DialogHeader>
            <DialogTitle>{expandedImage?.name ?? "Product image"}</DialogTitle>
            <DialogDescription>Large product image preview.</DialogDescription>
          </DialogHeader>
          {expandedImage ? (
            <div className="imageGalleryLargePreview">
              <Image
                alt={expandedImage.name}
                fill
                loader={passthroughImageLoader}
                sizes="(max-width: 960px) 92vw, 880px"
                src={expandedImage.url}
                unoptimized
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
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
    <Card className="formSection border-0">
      <div className="sectionTitleRow">
        <h3>Product variants</h3>
        <Button
          className="iconTextButton"
          onClick={onAdd}
          type="button"
          variant="outline"
        >
          <Plus aria-hidden size={16} />
          <span>Add variant</span>
        </Button>
      </div>
      {fields.length === 0 ? (
        <div className="emptyPanel smallEmpty">No variants added.</div>
      ) : null}
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
            onChange={(value) =>
              form.setValue(`variants.${index}.status`, value as ProductStatus, {
                shouldDirty: true,
                shouldValidate: true
              })
            }
            options={PRODUCT_STATUSES.map((status) => ({
              label: formatStatus(status),
              value: status
            }))}
            value={form.watch(`variants.${index}.status` as const)}
          />
          <TextAreaField
            error={errors.variants?.[index]?.attributesText?.message}
            label="Attributes JSON"
            registration={form.register(`variants.${index}.attributesText` as const)}
          />
          <Button
            aria-label="Remove variant"
            className="rowActionControl rowIconButton rowFloatingDelete"
            size="icon"
            onClick={() => onRemove(index)}
            type="button"
            variant="outline"
          >
            <Trash2 aria-hidden size={16} />
          </Button>
        </div>
      ))}
    </Card>
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
    <Card className="formSection border-0">
      <div className="sectionTitleRow">
        <h3>Product documents</h3>
        <Button
          className="iconTextButton"
          onClick={onAdd}
          type="button"
          variant="outline"
        >
          <Plus aria-hidden size={16} />
          <span>Add document</span>
        </Button>
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
            onChange={(value) =>
              form.setValue(
                `documents.${index}.type`,
                value as ProductFormValues["documents"][number]["type"],
                {
                  shouldDirty: true,
                  shouldValidate: true
                }
              )
            }
            options={PRODUCT_DOCUMENT_TYPES.map((type) => ({
              label: formatStatus(type),
              value: type
            }))}
            value={form.watch(`documents.${index}.type` as const)}
          />
          <TextField
            error={errors.documents?.[index]?.fileKey?.message}
            label="File key"
            registration={form.register(`documents.${index}.fileKey` as const)}
          />
          <div className="inlineUploadField">
            <TextField
              error={errors.documents?.[index]?.fileUrl?.message}
              label="File URL"
              registration={form.register(`documents.${index}.fileUrl` as const)}
            />
            <FileUploadButton
              className="fileUploadButton inlineUploadButton"
              inputProps={{
                accept: ".pdf,.doc,.docx,.xls,.xlsx,.csv,image/*",
                disabled: uploadingIndex !== null,
                onChange: (event) => onUpload(index, event.target.files?.[0])
              }}
            >
              <FileUp aria-hidden size={16} />
              <span>{uploadingIndex === index ? "Uploading..." : "Upload"}</span>
            </FileUploadButton>
          </div>
          <Button
            aria-label="Remove document"
            className="rowActionControl rowIconButton rowFloatingDelete"
            size="icon"
            onClick={() => onRemove(index)}
            type="button"
            variant="outline"
          >
            <Trash2 aria-hidden size={16} />
          </Button>
        </div>
      ))}
    </Card>
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
    <Label>
      {label}
      <Input inputMode={inputMode} placeholder={placeholder} {...registration} />
      {error ? <span className="fieldError">{error}</span> : null}
    </Label>
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
    <Label>
      {label}
      <Textarea {...registration} />
      {error ? <span className="fieldError">{error}</span> : null}
    </Label>
  );
}

function RichTextEditorField({
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
  const labelId = useId();
  const editorConfig = useMemo(
    () => ({
      namespace: "ProductDescriptionEditor",
      nodes: [HeadingNode, ListNode, ListItemNode, LinkNode],
      onError(errorToThrow: Error) {
        throw errorToThrow;
      },
      theme: richTextEditorTheme
    }),
    []
  );

  return (
    <div className="richTextField">
      <span className="richTextFieldLabel" id={labelId}>
        {label}
      </span>
      <LexicalComposer initialConfig={editorConfig}>
        <div className="lexicalEditorFrame" data-editor="lexical">
          <RichTextToolbar />
          <div className="richTextEditorShell">
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  aria-labelledby={labelId}
                  aria-multiline="true"
                  className="richTextEditor"
                />
              }
              placeholder={
                <span className="richTextPlaceholder">
                  Add formatted product description
                </span>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
          </div>
        </div>
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin />
        <ProductDescriptionValuePlugin onChange={onChange} value={value} />
      </LexicalComposer>
      {error ? <span className="fieldError">{error}</span> : null}
    </div>
  );
}

type RichTextBlockFormat = "paragraph" | HeadingTagType;

function RichTextToolbar() {
  const [editor] = useLexicalComposerContext();

  function formatText(format: TextFormatType) {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  }

  function formatElement(format: ElementFormatType) {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, format);
  }

  function formatBlock(format: RichTextBlockFormat) {
    editor.update(() => {
      const selection = $getSelection();

      if (!$isRangeSelection(selection)) {
        return;
      }

      $setBlocksType(selection, () =>
        format === "paragraph" ? $createParagraphNode() : $createHeadingNode(format)
      );
    });
  }

  function createLink() {
    const url = window.prompt("Enter link URL");

    if (url?.trim()) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, url.trim());
    }
  }

  return (
    <div className="richTextToolbar" aria-label="Description formatting tools">
      <div className="richTextFormatControl">
        <Select
          aria-label="Block format"
          onValueChange={(value) => {
            if (value !== RICH_TEXT_FORMAT_VALUE) {
              formatBlock(value as RichTextBlockFormat);
            }
          }}
          value={RICH_TEXT_FORMAT_VALUE}
        >
          <SelectTrigger className="richTextFormatSelect">
            <SelectValue placeholder="Format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={RICH_TEXT_FORMAT_VALUE}>Format</SelectItem>
            <SelectItem value="paragraph">Paragraph</SelectItem>
            <SelectItem value="h1">Heading 1</SelectItem>
            <SelectItem value="h2">Heading 2</SelectItem>
            <SelectItem value="h3">Heading 3</SelectItem>
            <SelectItem value="h4">Heading 4</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <EditorButton icon={Bold} label="Bold" onClick={() => formatText("bold")} />
      <EditorButton icon={Italic} label="Italic" onClick={() => formatText("italic")} />
      <EditorButton
        icon={Underline}
        label="Underline"
        onClick={() => formatText("underline")}
      />
      <EditorButton
        icon={ListOrdered}
        label="Ordered list"
        onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}
      />
      <EditorButton
        icon={List}
        label="Unordered list"
        onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
      />
      <EditorButton icon={LinkIcon} label="Link" onClick={createLink} />
      <EditorButton
        icon={AlignLeft}
        label="Align left"
        onClick={() => formatElement("left")}
      />
      <EditorButton
        icon={AlignCenter}
        label="Align center"
        onClick={() => formatElement("center")}
      />
      <EditorButton
        icon={AlignRight}
        label="Align right"
        onClick={() => formatElement("right")}
      />
    </div>
  );
}

function ProductDescriptionValuePlugin({
  onChange,
  value
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  const [editor] = useLexicalComposerContext();
  const lastHtmlRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastHtmlRef.current === value) {
      return;
    }

    editor.update(() => {
      const root = $getRoot();
      root.clear();

      if (value.trim()) {
        const parser = new DOMParser();
        const dom = parser.parseFromString(value, "text/html");
        const nodes = $generateNodesFromDOM(editor, dom);

        if (nodes.length > 0) {
          root.select();
          $insertNodes(nodes);
        }
      }

      if (root.getChildrenSize() === 0) {
        root.append($createParagraphNode());
      }

      lastHtmlRef.current = value;
    });
  }, [editor, value]);

  function syncHtml(editorState: EditorState, lexicalEditor: LexicalEditor) {
    editorState.read(
      () => {
        const html = $getRoot().getTextContent().trim()
          ? $generateHtmlFromNodes(lexicalEditor, null)
          : "";

        lastHtmlRef.current = html;
        onChange(html);
      },
      { editor: lexicalEditor }
    );
  }

  return (
    <OnChangePlugin
      ignoreHistoryMergeTagChange
      ignoreSelectionChange
      onChange={syncHtml}
    />
  );
}

function EditorButton({
  icon: Icon,
  label,
  onClick
}: {
  icon: typeof Bold;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      aria-label={label}
      className="iconOnlyButton richTextButton"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      size="icon"
      title={label}
      type="button"
      variant="outline"
    >
      <Icon aria-hidden size={16} />
    </Button>
  );
}

function SelectField({
  disabled,
  error,
  label,
  onChange,
  options,
  placeholder,
  value
}: {
  disabled?: boolean;
  error?: string;
  label: string;
  onChange: (value: string) => void;
  options: Array<{
    label: string;
    value: string;
  }>;
  placeholder?: string;
  value: string;
}) {
  const selectedValue =
    value || (placeholder ? FORM_SELECT_EMPTY_VALUE : options[0]?.value);

  return (
    <Label>
      {label}
      <Select
        disabled={disabled}
        onValueChange={(nextValue) =>
          onChange(nextValue === FORM_SELECT_EMPTY_VALUE ? "" : nextValue)
        }
        value={selectedValue}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {placeholder ? (
            <SelectItem value={FORM_SELECT_EMPTY_VALUE}>{placeholder}</SelectItem>
          ) : null}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <span className="fieldError">{error}</span> : null}
    </Label>
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
    <Select
      onValueChange={(nextValue) =>
        onChange(
          nextValue === BOOLEAN_FILTER_ANY_VALUE ? "" : (nextValue as BooleanFilter)
        )
      }
      value={value || BOOLEAN_FILTER_ANY_VALUE}
    >
      <SelectTrigger className="filterDrawerControl">
        <SelectValue placeholder="Any" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={BOOLEAN_FILTER_ANY_VALUE}>Any</SelectItem>
        <SelectItem value="true">Yes</SelectItem>
        <SelectItem value="false">No</SelectItem>
      </SelectContent>
    </Select>
  );
}

function buildProductQuery(filters: ProductFilters) {
  return {
    brand: filters.brand || undefined,
    category: filters.category || undefined,
    disposable: toOptionalBoolean(filters.disposable),
    expirySensitive: toOptionalBoolean(filters.expirySensitive),
    medicalSpecialty: filters.medicalSpecialty || undefined,
    search: filters.search || undefined,
    status: filters.status || undefined,
    sterile: toOptionalBoolean(filters.sterile),
    subcategory: filters.subcategory || undefined
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

function passthroughImageLoader({ src }: ImageLoaderProps) {
  return src;
}

function isPreviewableImageUrl(value: string) {
  if (value.startsWith("/uploads/")) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
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
