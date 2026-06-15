import type { ComponentPropsWithoutRef } from "react";
import { Chip as HeroChip, type ChipProps as HeroChipProps } from "@heroui/chip";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold",
  {
    defaultVariants: {
      variant: "default"
    },
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        destructive: "bg-destructive text-destructive-foreground",
        outline: "border border-border text-foreground",
        secondary: "bg-muted text-muted-foreground"
      }
    }
  }
);

export type BadgeProps = Omit<ComponentPropsWithoutRef<"span">, "color"> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  const heroProps = props as Omit<
    HeroChipProps,
    "as" | "className" | "color" | "radius" | "size" | "variant"
  >;

  return (
    <HeroChip
      {...heroProps}
      as="span"
      className={cn(badgeVariants({ className, variant }))}
      data-slot="badge"
      radius="full"
      size="sm"
      variant="flat"
    />
  );
}
