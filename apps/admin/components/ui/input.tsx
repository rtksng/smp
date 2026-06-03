import type { ComponentProps } from "react";
import { Input as HeroInput, type InputProps as HeroInputProps } from "@heroui/input";
import { cn } from "@/lib/utils";

export function Input({ className, type, value, ...props }: ComponentProps<"input">) {
  const heroProps = props as Omit<
    HeroInputProps,
    "className" | "classNames" | "radius" | "type" | "value" | "variant"
  >;

  return (
    <HeroInput
      {...heroProps}
      classNames={{
        input: "text-foreground placeholder:text-muted-foreground",
        inputWrapper: cn(
          "flex min-h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors shadow-none",
          "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20",
          "data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-60",
          className
        )
      }}
      data-slot="input"
      radius="sm"
      type={type}
      value={Array.isArray(value) ? value.join(",") : value?.toString()}
      variant="bordered"
    />
  );
}
