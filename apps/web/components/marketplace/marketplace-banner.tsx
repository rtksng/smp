import {
  ArrowRight,
  CirclePlus,
  FileCheck2,
  FileText,
  Headphones,
  IndianRupee,
  ShieldCheck,
  Star,
  Truck,
  Users,
  type LucideIcon
} from "lucide-react";
import Image from "next/image";
import { Button } from "../ui/button";
import { Container } from "../ui/container";

type MarketplaceBannerProps = {
  ctaHref: string;
  ctaText: string;
  imageAlt?: string;
  imageUrl?: string | null;
  secondaryCtaHref?: string;
  secondaryCtaText?: string;
  subtitle: string;
  title: string;
  tone?: "teal" | "navy" | "white";
};

const heroFeatures: Array<{
  Icon: LucideIcon;
  label: string;
}> = [
  { Icon: ShieldCheck, label: "Verified Products" },
  { Icon: FileCheck2, label: "GST Ready" },
  { Icon: Truck, label: "Fast & Reliable Delivery" },
  { Icon: Headphones, label: "Dedicated Support" }
];

const heroProof: Array<{
  Icon: LucideIcon;
  label: string;
  value: string;
}> = [
  { Icon: CirclePlus, label: "Products", value: "10,000+" },
  { Icon: Users, label: "Happy Clients", value: "5,000+" },
  { Icon: Star, label: "Quality Assured", value: "99%" },
  { Icon: IndianRupee, label: "Made Easy", value: "GST Billing" }
];

export function MarketplaceBanner({
  ctaHref,
  ctaText,
  imageAlt = "Medical procurement products",
  imageUrl,
  secondaryCtaHref,
  secondaryCtaText,
  subtitle,
  title
}: MarketplaceBannerProps) {
  return (
    <section
      className="relative isolate overflow-hidden rounded-[1.75rem] border border-[#cfe4f8] bg-[linear-gradient(180deg,#ffffff_0%,#f1f8ff_100%)] shadow-xl shadow-[#0b5cab]/10"
      data-testid="customer-hero"
    >
      {imageUrl ? (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-0 hidden bg-cover bg-[center_right] md:block"
            data-testid="hero-background-image"
            style={{ backgroundImage: `url(${imageUrl})` }}
          />
          <Image
            alt={imageAlt}
            className="sr-only"
            height={1}
            src={imageUrl}
            unoptimized={imageUrl.startsWith("http://localhost")}
            width={1}
          />
        </>
      ) : (
        <div className="absolute inset-0 hidden bg-[linear-gradient(135deg,#ffffff,#d8ebff)] md:block" />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 hidden w-[66%] bg-[linear-gradient(90deg,rgba(248,252,255,0.98)_0%,rgba(248,252,255,0.94)_62%,rgba(248,252,255,0)_100%)] md:block"
        style={{ clipPath: "polygon(0 0, 82% 0, 100% 100%, 0 100%)" }}
      />

      <div className="relative z-10 flex min-h-[34rem] flex-col px-5 py-8 sm:px-8 sm:py-10 md:min-h-[32rem] md:px-10 md:py-12 lg:min-h-[36rem] lg:px-16 lg:py-14">
        <div className="max-w-[48rem] md:max-w-[44rem] lg:max-w-[50rem]">
          <h1 className="max-w-4xl text-4xl font-bold leading-[1.04] text-[#082e5d] sm:text-5xl lg:text-[4.25rem]">
            <HighlightedTitle title={title} />
          </h1>

          <div className="mt-6 h-1.5 w-24 rounded-full bg-[#0d74e6]" />

          <p className="mt-6 max-w-[42rem] text-base font-semibold leading-7 text-[#455d78] sm:text-xl sm:leading-8">
            {subtitle}
          </p>

          <div className="mt-8 grid max-w-[43rem] grid-cols-2 gap-y-5 text-center sm:grid-cols-4">
            {heroFeatures.map(({ Icon, label }, index) => (
              <div
                className={[
                  "relative flex flex-col items-center gap-3 px-2 text-[#082e5d]",
                  index < heroFeatures.length - 1
                    ? "sm:after:absolute sm:after:right-0 sm:after:top-8 sm:after:h-16 sm:after:w-px sm:after:bg-[#cfe4f8]"
                    : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={label}
              >
                <span className="grid h-16 w-16 place-items-center rounded-full bg-[#ddecff] text-[#0b66ca]">
                  <Icon aria-hidden="true" className="h-8 w-8" strokeWidth={2.4} />
                </span>
                <span className="max-w-36 text-sm font-black leading-5 sm:text-base">
                  {label}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button
              className="min-h-14 w-full !px-8 text-base sm:w-auto"
              href={ctaHref}
              variant="primary"
            >
              {ctaText}
              <ArrowRight aria-hidden="true" className="h-5 w-5" />
            </Button>
            {secondaryCtaHref && secondaryCtaText ? (
              <Button
                className="min-h-14 w-full !border-[#0b66ca] !bg-white/80 !px-8 text-base sm:w-auto"
                href={secondaryCtaHref}
                variant="outline"
              >
                {secondaryCtaText}
                <FileText aria-hidden="true" className="h-5 w-5" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export function MarketplaceProofStrip() {
  return (
    <section
      aria-label="Marketplace trust metrics"
      className="bg-[#f4f9ff] pb-8 sm:pb-10"
      data-testid="hero-proof-section"
    >
      <Container>
        <div
          className="grid gap-4 rounded-[1.35rem] bg-[linear-gradient(90deg,#064fa8_0%,#0874e4_100%)] p-5 text-white shadow-xl shadow-[#0b5cab]/20 sm:grid-cols-2 md:grid-cols-4 md:items-center md:gap-0 md:p-5"
          data-testid="hero-proof-strip"
        >
          {heroProof.map(({ Icon, label, value }) => (
            <div
              className="flex min-h-16 items-center gap-3 border-white/20 md:px-5 md:[&:not(:first-child)]:border-l"
              key={label}
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-white text-white">
                <Icon aria-hidden="true" className="h-7 w-7" strokeWidth={2.4} />
              </span>
              <p className="text-base font-bold leading-6">
                {value ? (
                  <span className="block text-xl font-black">{value}</span>
                ) : null}
                <span className="block">{label}</span>
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function HighlightedTitle({ title }: { title: string }) {
  const highlightedText = "simply.";
  const highlightedIndex = title.toLowerCase().lastIndexOf(highlightedText);

  if (highlightedIndex === -1) {
    return title;
  }

  return (
    <>
      {title.slice(0, highlightedIndex)}
      <span className="text-[#0d74e6]">{title.slice(highlightedIndex)}</span>
    </>
  );
}
