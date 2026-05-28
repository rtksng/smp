import {
  BadgeIndianRupee,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  PackageCheck,
  ShieldCheck,
  Truck
} from "lucide-react";
import Image from "next/image";
import { getBrands } from "../../lib/api/brands";
import { getCategories } from "../../lib/api/categories";
import { getProducts } from "../../lib/api/products";
import { getBrandImageAlt } from "../../lib/seo/metadata";
import { Footer } from "../layout/footer";
import { Header } from "../layout/header";
import { Button } from "../ui/button";
import { CategoryCard } from "../ui/category-card";
import { Container } from "../ui/container";
import { EmptyState } from "../ui/empty-state";
import { ErrorState } from "../ui/error-state";
import { ProductCard } from "../ui/product-card";
import { SectionHeader } from "../ui/section-header";
import { SearchForm } from "./search-form";

const quickSearches = [
  "Sutures",
  "Sterile gloves",
  "Pulse oximeter",
  "OT light"
] as const;

const heroSignals = [
  "Verified medical brands",
  "GST-ready invoices",
  "Bulk quote support"
] as const;

const procurementStats = [
  { label: "Catalog depth", value: "Surgical, diagnostics, consumables" },
  { label: "Purchase support", value: "Single units and bulk orders" },
  { label: "Checkout", value: "COD and online payment ready" }
] as const;

const trustCards = [
  {
    description: "Product pages separate sterile, disposable, tax, pack, and specialty details.",
    icon: ShieldCheck,
    title: "Clinical details upfront"
  },
  {
    description: "Cart and checkout keep stock warnings visible before order submission.",
    icon: Truck,
    title: "Availability-aware purchase"
  },
  {
    description: "GST and invoice context is visible where procurement teams evaluate price.",
    icon: FileText,
    title: "Invoice-first pricing"
  },
  {
    description: "Hospitals and clinics can request support for high-volume purchase lists.",
    icon: Building2,
    title: "Bulk order desk"
  },
  {
    description: "Checkout supports secure online flow and COD where available.",
    icon: CreditCard,
    title: "Flexible payment"
  }
] as const;

const workflowHighlights = [
  "Search by product, SKU, brand, or specialty.",
  "Filter by stock, sterile, disposable, expiry-sensitive, and price.",
  "Review GST, pack size, and medical details before adding to cart.",
  "Move from cart to checkout with address, payment, and confirmation steps."
] as const;

export async function HomePage() {
  const [categories, brands, products] = await Promise.all([
    safeRead(getCategories()),
    safeRead(getBrands()),
    safeRead(
      getProducts({
        limit: 6,
        sort: "latest"
      })
    )
  ]);

  return (
    <>
      <Header />
      <main>
        <section className="border-b border-[#d8e2df] bg-white">
          <Container className="grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.78fr)] lg:items-center lg:py-14">
            <div className="max-w-3xl">
              <p className="mb-3 text-xs font-extrabold uppercase text-[#9b6a1e]">
                Surgical and medical procurement
              </p>
              <h1 className="text-4xl font-extrabold leading-tight text-[#17211f] sm:text-5xl lg:text-6xl">
                Medical equipment buying built for hospital teams.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[#596965] sm:text-lg sm:leading-8">
                Search surgical instruments, diagnostics, critical care equipment,
                consumables, and verified brands with the purchase details procurement
                teams need before checkout.
              </p>

              <div className="mt-8 rounded-lg border border-[#d8e2df] bg-[#f8fbfa] p-4 shadow-sm">
                <SearchForm
                  id="hero-search"
                  placeholder="Search products, SKU, brand"
                  suggestions={[...quickSearches]}
                />
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {heroSignals.map((item) => (
                  <span
                    className="inline-flex items-center gap-2 rounded-full border border-[#d8e2df] bg-white px-3 py-2 text-sm font-extrabold text-[#31413d]"
                    key={item}
                  >
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-[#006d77]" />
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
                <Button className="w-full sm:w-auto" href="/products">
                  Browse all products
                </Button>
                <Button className="w-full sm:w-auto" href="#bulk" variant="outline">
                  <BadgeIndianRupee aria-hidden="true" className="h-4 w-4" />
                  Request bulk quote
                </Button>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="relative min-h-80 overflow-hidden rounded-lg border border-[#d8e2df] bg-[#eef3f1] shadow-xl sm:min-h-96">
                <Image
                  alt="Clinical equipment and supplies prepared for hospital procurement"
                  className="object-cover"
                  fill
                  priority
                  sizes="(min-width: 1024px) 42vw, 100vw"
                  src="https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=1200&q=80"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {procurementStats.map((stat) => (
                  <div
                    className="rounded-lg border border-[#d8e2df] bg-white p-4 shadow-sm"
                    key={stat.label}
                  >
                    <p className="text-xs font-extrabold uppercase text-[#9b6a1e]">
                      {stat.label}
                    </p>
                    <p className="mt-2 text-sm font-extrabold leading-5 text-[#17211f]">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Container>
        </section>

        <section className="py-14" id="categories">
          <Container>
            <SectionHeader
              description="Start from the clinical workflow, then narrow by brand, price, stock, and product attributes."
              eyebrow="Categories"
              title="Browse by hospital department"
              action={<Button href="/products" variant="outline">Open catalog</Button>}
            />
            {!categories ? (
              <ErrorState
                message="Category catalog data is unavailable right now."
                title="Unable to load categories"
              />
            ) : null}
            {categories && categories.length === 0 ? (
              <EmptyState
                description="No active customer categories are available yet."
                title="No categories found"
              />
            ) : null}
            {categories && categories.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {categories.slice(0, 8).map((category) => (
                  <CategoryCard category={category} key={category.id} />
                ))}
              </div>
            ) : null}
          </Container>
        </section>

        <section className="bg-[#eef3f1] py-14" id="products">
          <Container>
            <SectionHeader
              description="Cards show hospital price, MRP savings, GST context, SKU, and stock state without forcing buyers into a product page first."
              eyebrow="Featured products"
              title="Procurement-ready product cards"
              action={<Button href="/products" variant="outline">View all products</Button>}
            />
            {!products ? (
              <ErrorState
                message="Product catalog data is unavailable right now."
                title="Unable to load products"
              />
            ) : null}
            {products && products.items.length === 0 ? (
              <EmptyState
                description="Try another product name, SKU, brand, or medical specialty."
                title="No products found"
              />
            ) : null}
            {products && products.items.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {products.items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : null}
          </Container>
        </section>

        <section className="bg-white py-14">
          <Container>
            <div className="grid gap-8 lg:grid-cols-[0.78fr_1fr] lg:items-start">
              <SectionHeader
                description="The shopping flow is organized around repeat purchase and clinical review, not promotional clutter."
                eyebrow="Workflow"
                title="Faster from product search to order review"
              />
              <div className="grid gap-3">
                {workflowHighlights.map((item) => (
                  <div className="flex gap-3 rounded-lg border border-[#d8e2df] bg-[#f8fbfa] p-4" key={item}>
                    <PackageCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[#006d77]" />
                    <p className="text-sm font-bold leading-6 text-[#31413d]">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </Container>
        </section>

        <section className="py-14" id="brands">
          <Container>
            <SectionHeader
              description="Jump into verified supplier catalogs without scanning through promotional carousels."
              eyebrow="Popular brands"
              title="Source from trusted medical suppliers"
            />
            {!brands ? (
              <ErrorState
                message="Brand catalog data is unavailable right now."
                title="Unable to load brands"
              />
            ) : null}
            {brands && brands.length === 0 ? (
              <EmptyState
                description="No active customer brands are available yet."
                title="No brands found"
              />
            ) : null}
            {brands && brands.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {brands.slice(0, 8).map((brand) => (
                  <a className="flex min-h-28 items-center gap-4 rounded-lg border border-[#d8e2df] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#006d77] hover:shadow-lg" href={`/brands/${brand.slug}`} key={brand.id}>
                    {brand.logoUrl ? (
                      <Image
                        alt={getBrandImageAlt(brand.name)}
                        className="rounded-lg object-contain"
                        height={48}
                        src={brand.logoUrl}
                        width={48}
                      />
                    ) : (
                      <span className="grid h-12 w-12 place-items-center rounded-lg bg-[#e7f3f2] text-lg font-extrabold text-[#006d77]">
                        {brand.name.slice(0, 1)}
                      </span>
                    )}
                    <div>
                      <h3 className="font-extrabold text-[#17211f]">{brand.name}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-[#687773]">
                        {brand.description ?? "Verified catalog supplier"}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            ) : null}
          </Container>
        </section>

        <section className="bg-[#f8fbfa] py-14">
          <Container>
            <SectionHeader
              description="Useful purchase signals stay close to the product, cart, and checkout steps."
              eyebrow="Trust"
              title="Procurement support beyond the product card"
            />
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
              {trustCards.map((card) => {
                const Icon = card.icon;

                return (
                  <article className="rounded-lg border border-[#d8e2df] bg-white p-5" key={card.title}>
                    <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#e7f3f2] text-[#006d77]">
                      <Icon aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <h3 className="mt-5 text-base font-extrabold text-[#17211f]">
                      {card.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[#687773]">{card.description}</p>
                  </article>
                );
              })}
            </div>
          </Container>
        </section>

        <section className="py-16" id="bulk">
          <Container>
            <div className="grid gap-8 rounded-lg bg-[#084c61] p-6 text-white md:grid-cols-[1fr_auto] md:items-center md:p-8">
              <div>
                <p className="text-xs font-extrabold uppercase text-[#f7d68a]">
                  Hospitals and clinics
                </p>
                <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">
                  Planning a bulk surgical or medical equipment purchase?
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">
                  Share SKUs, preferred brands, quantities, and delivery needs for quote
                  support, GST invoice handling, and order coordination.
                </p>
              </div>
              <Button className="w-full md:w-auto" href="mailto:support@surgical.example" variant="outline">
                Request bulk quote
              </Button>
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}

async function safeRead<T>(promise: Promise<T>): Promise<T | undefined> {
  try {
    return await promise;
  } catch {
    return undefined;
  }
}
