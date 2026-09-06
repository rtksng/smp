"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ImageUp, RefreshCw } from "lucide-react";
import { AdminShell } from "../admin-shell";
import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProtectedRoute, useAdminSession } from "@/lib/admin-session";
import type { AdminCategory } from "@/lib/catalog-management";
import type { AdminProduct, ProductListResponse } from "@/lib/product-form";
import { ADMIN_PERMISSION } from "@/lib/permissions";

type UploadResponse = {
  key: string;
  mimeType: string;
  size: number;
  url: string;
};

type FlatCategory = AdminCategory & {
  categoryPath: string;
  rootName: string;
};

type CatalogState = {
  categories: FlatCategory[];
  products: AdminProduct[];
};

type Progress = {
  current: number;
  label: string;
  stage: string;
  total: number;
};

const MASTER_IMAGES = [
  { file: "surgical-instruments.png", key: "surgical-instruments", keywords: ["surgical", "surgery", "instrument", "forceps", "scissor", "scalpel", "stainless", "operating"] },
  { file: "ppe-consumables.png", key: "ppe-consumables", keywords: ["ppe", "protective", "mask", "glove", "gown", "cap", "shoe cover", "infection", "disposable", "consumable"] },
  { file: "injection-iv.png", key: "injection-iv", keywords: ["syringe", "needle", "cannula", "infusion", "injection", "intravenous", "iv ", "catheter"] },
  { file: "wound-care.png", key: "wound-care", keywords: ["wound", "gauze", "bandage", "dressing", "cotton", "tape", "suture", "first aid"] },
  { file: "vital-signs.png", key: "vital-signs", keywords: ["blood pressure", "oximeter", "thermometer", "stethoscope", "vital", "examination", "diagnostic"] },
  { file: "respiratory-care.png", key: "respiratory-care", keywords: ["respiratory", "oxygen", "nebulizer", "nebuliser", "ventilator", "airway", "spirometer"] },
  { file: "laboratory-diagnostics.png", key: "laboratory-diagnostics", keywords: ["laboratory", "lab ", "centrifuge", "pipette", "specimen", "test", "pathology", "reagent"] },
  { file: "dental-care.png", key: "dental-care", keywords: ["dental", "dentist", "orthodont", "endodont", "restorative", "impression", "oral"] },
  { file: "ophthalmology.png", key: "ophthalmology", keywords: ["ophthalm", "optical", "eye", "vision", "lens", "retina"] },
  { file: "orthopaedic-physio.png", key: "orthopaedic-physio", keywords: ["orthop", "physio", "brace", "support", "rehabilitation", "mobility aid", "splint", "collar"] },
  { file: "hospital-furniture.png", key: "hospital-furniture", keywords: ["furniture", "hospital bed", "bedside", "wheelchair", "stretcher", "table", "trolley", "stand"] },
  { file: "cardiology-critical-care.png", key: "cardiology-critical-care", keywords: ["cardio", "ecg", "ekg", "heart", "critical care", "monitor", "electrode"] },
  { file: "pharma-cold-chain.png", key: "pharma-cold-chain", keywords: ["pharma", "medicine", "drug", "vaccine", "cold chain", "vial", "tablet", "capsule"] }
] as const;

const WRITE_INTERVAL_MS = 1_050;
const CATEGORY_WORKERS = 4;

export default function CatalogImagesPage() {
  return (
    <AdminShell>
      <ProtectedRoute permission={ADMIN_PERMISSION.ProductsUpdate}>
        <CatalogImagesContent />
      </ProtectedRoute>
    </AdminShell>
  );
}

function CatalogImagesContent() {
  const { api } = useAdminSession();
  const [catalog, setCatalog] = useState<CatalogState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);

  const missingProducts = useMemo(
    () => catalog?.products.filter((product) => !hasProductImage(product)) ?? [],
    [catalog]
  );
  const missingCategories = useMemo(
    () => catalog?.categories.filter((category) => !hasCategoryImage(category)) ?? [],
    [catalog]
  );

  const loadCatalog = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [categoryTree, products] = await Promise.all([
        api.request<AdminCategory[]>("/admin/categories"),
        listAllProducts(api.request)
      ]);
      const next = { categories: flattenCategories(categoryTree), products };
      setCatalog(next);
      return next;
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  async function runBackfill() {
    setError(null);
    setMessage(null);
    setIsRunning(true);
    setProgress(null);

    try {
      const latest = await loadCatalog();
      if (!latest) {
        return;
      }

      const products = latest.products.filter((product) => !hasProductImage(product));
      const categories = latest.categories.filter((category) => !hasCategoryImage(category));
      if (products.length === 0 && categories.length === 0) {
        setMessage("Every product and category already has an image.");
        return;
      }

      const requiredMasters = Array.from(
        new Set(products.map((product) => selectMaster(product).key))
      );
      const uploadedMasterUrls = new Map<string, string>();

      for (const [index, key] of requiredMasters.entries()) {
        const master = MASTER_IMAGES.find((item) => item.key === key);
        if (!master) {
          continue;
        }
        setProgress({
          current: index + 1,
          label: key,
          stage: "Uploading reusable product masters",
          total: requiredMasters.length
        });
        const source = await fetch(`/catalog-images/masters/${master.file}`);
        if (!source.ok) {
          throw new Error(`Could not load ${master.file}.`);
        }
        const url = await uploadImage(
          api.request,
          await source.blob(),
          `catalog-master-${master.key}.png`,
          "product_image"
        );
        uploadedMasterUrls.set(master.key, url);
        await sleep(WRITE_INTERVAL_MS);
      }

      for (const [index, product] of products.entries()) {
        const master = selectMaster(product);
        const url = uploadedMasterUrls.get(master.key);
        if (!url) {
          throw new Error(`The ${master.key} product master was not uploaded.`);
        }
        setProgress({
          current: index + 1,
          label: product.name,
          stage: "Assigning product images",
          total: products.length
        });
        await retryTransientRequest(() =>
          api.request(`/admin/products/${encodeURIComponent(product.id)}`, {
            body: JSON.stringify({
              images: [
                {
                  altText: `${product.name} product image`,
                  isPrimary: true,
                  sortOrder: 0,
                  url
                }
              ]
            }),
            method: "PATCH"
          })
        );
        await sleep(WRITE_INTERVAL_MS);
      }

      let nextCategoryIndex = 0;
      let completedCategories = 0;
      const failedCategories: string[] = [];
      const categoryWorker = async () => {
        while (nextCategoryIndex < categories.length) {
          const category = categories[nextCategoryIndex++]!;
          try {
            const master = selectMaster(category);
            const categoryImage = await renderCategoryPng(category, master.file);
            const url = await retryTransientRequest(() =>
              uploadImage(
                api.request,
                categoryImage,
                `${slugify(category.slug || category.name)}-category.png`,
                "category_image"
              )
            );
            await retryTransientRequest(() =>
              api.request(`/admin/categories/${encodeURIComponent(category.id)}`, {
                body: JSON.stringify({ imageUrl: url }),
                method: "PATCH"
              })
            );
            completedCategories += 1;
            setProgress({
              current: completedCategories,
              label: category.name,
              stage: "Creating and uploading category PNGs",
              total: categories.length
            });
          } catch {
            failedCategories.push(category.name);
          }
          await sleep(WRITE_INTERVAL_MS);
        }
      };
      await Promise.all(
        Array.from(
          { length: Math.min(CATEGORY_WORKERS, categories.length) },
          () => categoryWorker()
        )
      );
      if (failedCategories.length > 0) {
        throw new Error(
          `${failedCategories.length} category image uploads did not finish. Run the missing-only backfill again.`
        );
      }

      const verified = await loadCatalog();
      const remainingProducts =
        verified?.products.filter((product) => !hasProductImage(product)).length ?? products.length;
      const remainingCategories =
        verified?.categories.filter((category) => !hasCategoryImage(category)).length ?? categories.length;
      setProgress(null);
      setMessage(
        `Backfill complete. Added images to ${products.length} products and ${categories.length} categories. ` +
          `${remainingProducts} products and ${remainingCategories} categories remain without images.`
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <>
      <Card className="panel">
        <PageHeader
          actions={
            <Button
              aria-label="Refresh image coverage"
              disabled={isLoading || isRunning}
              onClick={() => void loadCatalog()}
              size="icon"
              type="button"
              variant="outline"
            >
              <RefreshCw aria-hidden size={17} />
            </Button>
          }
          eyebrow="Catalog media"
          title="Backfill missing catalog images"
        />
        <p className="sectionCopy">
          Assigns 13 reusable medical product masters and creates a named PNG for every category that has no
          image. Existing images and all non-image catalog data stay unchanged.
        </p>
      </Card>

      <div className="metricGrid">
        <MetricCard
          label="Products with images"
          value={catalog ? catalog.products.length - missingProducts.length : "—"}
        />
        <MetricCard label="Products missing" value={catalog ? missingProducts.length : "—"} />
        <MetricCard
          label="Categories with images"
          value={catalog ? catalog.categories.length - missingCategories.length : "—"}
        />
        <MetricCard label="Categories missing" value={catalog ? missingCategories.length : "—"} />
      </div>

      <Card className="panel stack">
        <div className="sectionHeading">
          <div>
            <h2>Image-only update</h2>
            <p className="sectionCopy">
              Product masters are uploaded once to Railway object storage and reused across matching products.
              Category images include the live category name and a color-coded medical tile.
            </p>
          </div>
        </div>

        {progress ? (
          <p aria-live="polite" className="sectionCopy">
            {progress.stage}: {progress.current} of {progress.total} — {progress.label}
          </p>
        ) : null}
        {message ? <p aria-live="polite" className="successText">{message}</p> : null}
        {error ? <p aria-live="assertive" className="errorText">{error}</p> : null}

        <div className="buttonRow">
          <Button
            disabled={isLoading || isRunning || !catalog}
            onClick={() => void runBackfill()}
            type="button"
          >
            <ImageUp aria-hidden size={17} />
            {isRunning ? "Backfill in progress" : "Backfill missing images"}
          </Button>
        </div>
      </Card>
    </>
  );
}

function flattenCategories(categories: AdminCategory[], ancestors: string[] = []): FlatCategory[] {
  return categories.flatMap((category) => {
    const trail = [...ancestors, category.name];
    const flatCategory = {
      ...category,
      categoryPath: trail.join(" / "),
      rootName: trail[0] ?? category.name
    };
    return [flatCategory, ...flattenCategories(category.children ?? [], trail)];
  });
}

async function listAllProducts(request: ReturnType<typeof useAdminSession>["api"]["request"]) {
  const products: AdminProduct[] = [];
  for (let page = 1; ; page += 1) {
    const response = await request<ProductListResponse>("/admin/products", {
      query: { limit: 100, page }
    });
    products.push(...response.items);
    if (!response.pagination.hasNextPage) {
      return products;
    }
  }
}

function hasProductImage(product: AdminProduct) {
  return product.images.some((image) => image.url.trim().length > 0);
}

function hasCategoryImage(category: FlatCategory) {
  return String(category.imageUrl ?? "").trim().length > 0;
}

function searchableRecord(record: AdminProduct | FlatCategory) {
  if ("categoryPath" in record) {
    return `${record.name} ${record.slug} ${record.categoryPath} ${record.rootName}`.toLowerCase();
  }
  return [
    record.name,
    record.slug,
    record.category.name,
    record.category.slug,
    record.subcategory?.name,
    record.subcategory?.slug,
    record.medicalSpecialty,
    ...record.searchTags
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function selectMaster(record: AdminProduct | FlatCategory) {
  const text = searchableRecord(record);
  let best: (typeof MASTER_IMAGES)[number] | null = null;
  let bestScore = 0;
  for (const master of MASTER_IMAGES) {
    const score = master.keywords.reduce(
      (total, keyword) => total + (text.includes(keyword) ? keyword.trim().split(/\s+/).length : 0),
      0
    );
    if (score > bestScore) {
      best = master;
      bestScore = score;
    }
  }
  return best ?? MASTER_IMAGES[hashString(text) % MASTER_IMAGES.length]!;
}

async function uploadImage(
  request: ReturnType<typeof useAdminSession>["api"]["request"],
  blob: Blob,
  filename: string,
  purpose: "category_image" | "product_image"
) {
  const body = new FormData();
  body.append("purpose", purpose);
  body.append("file", new File([blob], filename, { type: "image/png" }));
  const upload = await request<UploadResponse>("/uploads/image", { body, method: "POST" });
  return upload.url;
}

async function renderCategoryPng(category: FlatCategory, masterFilename: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 432;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("The browser could not create the category image canvas.");
  }

  const background = context.createLinearGradient(0, 0, 720, 432);
  background.addColorStop(0, "#f8fbff");
  background.addColorStop(1, "#e8f3ff");
  context.fillStyle = background;
  context.fillRect(0, 0, 720, 432);

  context.fillStyle = "rgba(212, 237, 242, 0.72)";
  context.beginPath();
  context.arc(85, 70, 43, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#146c7e";
  context.font = "700 15px Arial, sans-serif";
  context.fillText("CATEGORY", 46, 98);

  const lines = wrapText(context, category.name, 324, 35);
  context.fillStyle = "#17324d";
  context.font = "700 35px Arial, sans-serif";
  lines.forEach((line, index) => context.fillText(line, 46, 169 + index * 43));

  context.fillStyle = "#587089";
  context.font = "400 17px Arial, sans-serif";
  context.fillText(
    category.rootName === category.name
      ? "Medical supplies collection"
      : `${category.rootName} collection`,
    46,
    324 + Math.max(0, lines.length - 2) * 22
  );

  const palettes = [
    ["#d9f2f2", "#177987"],
    ["#e6ecff", "#455fb8"],
    ["#e5f4eb", "#2c7a57"],
    ["#f7eadf", "#a75b36"],
    ["#eee8fa", "#6d55a3"]
  ] as const;
  const [tileColor, accentColor] = palettes[hashString(masterFilename) % palettes.length]!;
  context.fillStyle = tileColor;
  roundedRect(context, 430, 54, 240, 324, 28);
  context.fill();

  context.fillStyle = "rgba(255, 255, 255, 0.72)";
  context.beginPath();
  context.arc(550, 170, 76, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = accentColor;
  roundedRect(context, 526, 112, 48, 116, 13);
  context.fill();
  roundedRect(context, 492, 146, 116, 48, 13);
  context.fill();

  const initials = category.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  context.fillStyle = accentColor;
  context.font = "700 42px Arial, sans-serif";
  context.textAlign = "center";
  context.fillText(initials || "MC", 550, 322);
  context.textAlign = "start";

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Category PNG rendering failed."))),
      "image/png"
    );
  });
}

function wrapText(context: CanvasRenderingContext2D, value: string, maxWidth: number, fontSize: number) {
  context.font = `700 ${fontSize}px Arial, sans-serif`;
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  for (const word of words) {
    const current = lines.at(-1);
    if (!current || context.measureText(`${current} ${word}`).width > maxWidth) {
      if (lines.length === 3) {
        lines[2] = `${lines[2]!.slice(0, Math.max(1, lines[2]!.length - 3))}...`;
        break;
      }
      lines.push(word);
    } else {
      lines[lines.length - 1] = `${current} ${word}`;
    }
  }
  return lines;
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function hashString(value: string) {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function retryTransientRequest<T>(operation: () => Promise<T>) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await sleep(1_500 * (attempt + 1));
      }
    }
  }
  throw lastError;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Catalog image backfill failed.";
}
