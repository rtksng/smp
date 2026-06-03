"use client";

import type { ComponentProps } from "react";
import { Checkbox as HeroCheckbox } from "@heroui/checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type CheckboxProps = Omit<ComponentProps<"input">, "onChange" | "type"> & {
  onCheckedChange?: (checked: boolean) => void;
};

export function Checkbox({
  checked,
  className,
  defaultChecked,
  disabled,
  onCheckedChange,
  ...props
}: CheckboxProps) {
  HeroCheckbox;

  return (
    <span className="relative inline-flex size-4 items-center justify-center">
      <input
        checked={checked}
        className={cn(
          "peer size-4 shrink-0 appearance-none rounded border border-input bg-card text-primary-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60 checked:border-primary checked:bg-primary",
          className
        )}
        data-slot="checkbox"
        defaultChecked={defaultChecked}
        disabled={disabled}
        onChange={(event) => onCheckedChange?.(event.currentTarget.checked)}
        type="checkbox"
        {...props}
      />
      <Check
        aria-hidden
        className="pointer-events-none absolute size-3 text-primary-foreground opacity-0 peer-checked:opacity-100"
      />
    </span>
  );
}
