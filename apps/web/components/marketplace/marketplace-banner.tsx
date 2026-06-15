import { ArrowRight, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { Button } from "../ui/button";

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

const toneClassNames = {
  navy: "bg-[#0b4f9f] text-white",
  teal: "bg-[#edf6ff] text-[#12314f]",
  white: "bg-white text-[#12314f]"
} satisfies Record<NonNullable<MarketplaceBannerProps["tone"]>, string>;

export function MarketplaceBanner({
  ctaHref,
  ctaText,
  imageAlt = "Medical procurement products",
  imageUrl,
  secondaryCtaHref,
  secondaryCtaText,
  subtitle,
  title,
  tone = "teal"
}: MarketplaceBannerProps) {
  const isDark = tone === "navy";

  return (
    <div
      className={[
        "overflow-hidden rounded-[2rem] border border-[#cfe4f8] shadow-sm shadow-[#0b5cab]/10",
        toneClassNames[tone]
      ].join(" ")}
    >
      <div className="grid gap-7 p-5 sm:gap-8 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.44fr)] lg:items-center lg:p-10">
        <div className="min-w-0">
          <h1 className="max-w-3xl text-3xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          <p
            className={[
              "mt-5 max-w-2xl text-base leading-7 sm:text-lg",
              isDark ? "text-white/80" : "text-[#4f6580]"
            ].join(" ")}
          >
            {subtitle}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button
              className="w-full sm:w-auto"
              href={ctaHref}
              variant={isDark ? "secondary" : "primary"}
            >
              {ctaText}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Button>
            {secondaryCtaHref && secondaryCtaText ? (
              <Button
                className="w-full sm:w-auto"
                href={secondaryCtaHref}
                variant={isDark ? "outline" : "secondary"}
              >
                {secondaryCtaText}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="relative min-h-48 overflow-hidden rounded-[1.5rem] border border-[#d6e7f8] bg-white/45 shadow-lg shadow-[#0b5cab]/10 sm:min-h-64 lg:min-h-80">
          {imageUrl ? (
            <Image
              alt={imageAlt}
              className="object-cover"
              fill
              priority
              sizes="(min-width: 1024px) 34vw, 100vw"
              src={imageUrl}
              unoptimized={imageUrl.startsWith("http://localhost")}
            />
          ) : (
            <div className="flex h-full min-h-48 items-center justify-center bg-[linear-gradient(135deg,#ffffff,#d8ebff)] text-[#0b5cab] sm:min-h-64">
              <ShieldCheck aria-hidden="true" className="h-20 w-20" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
