import type { CSSProperties, ComponentPropsWithoutRef } from "react";
import {
  Card as HeroCard,
  CardBody as HeroCardBody,
  type CardProps as HeroCardProps
} from "@heroui/card";
import { cn } from "@/lib/utils";

type DivProps = ComponentPropsWithoutRef<"div">;

export function Card({ className, style, ...props }: DivProps) {
  const heroProps = props as Omit<
    HeroCardProps,
    "as" | "className" | "radius" | "shadow" | "style"
  >;
  const cardStyle: CSSProperties = {
    ...style,
    display: style?.display ?? "flex",
    flexDirection: style?.flexDirection ?? "column"
  };

  return (
    <HeroCard
      {...heroProps}
      as="div"
      className={cn("rounded-lg border border-border bg-card text-card-foreground", className)}
      data-slot="card"
      radius="sm"
      shadow="none"
      style={cardStyle}
    />
  );
}

export function CardHeader({ className, ...props }: DivProps) {
  return (
    <div
      className={cn("grid gap-1.5 p-6", className)}
      data-slot="card-header"
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: DivProps) {
  return (
    <div
      className={cn("text-2xl font-bold leading-none text-foreground", className)}
      data-slot="card-title"
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: DivProps) {
  return (
    <div
      className={cn("text-sm text-muted-foreground", className)}
      data-slot="card-description"
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: DivProps) {
  const heroProps = props as Omit<ComponentPropsWithoutRef<typeof HeroCardBody>, "className">;

  return (
    <HeroCardBody
      {...heroProps}
      className={cn("p-6 pt-0", className)}
      data-slot="card-content"
    />
  );
}

export function CardFooter({ className, ...props }: DivProps) {
  return (
    <div
      className={cn("flex items-center gap-2 p-6 pt-0", className)}
      data-slot="card-footer"
      {...props}
    />
  );
}
