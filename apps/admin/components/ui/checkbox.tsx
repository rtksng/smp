"use client";

import type { ComponentProps } from "react";
import {
  Checkbox as HeroCheckbox,
  type CheckboxProps as HeroCheckboxProps
} from "@heroui/checkbox";
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
  const heroProps = props as Omit<
    HeroCheckboxProps,
    | "checked"
    | "className"
    | "classNames"
    | "defaultSelected"
    | "icon"
    | "isDisabled"
    | "isSelected"
    | "onValueChange"
    | "radius"
  >;

  return (
    <HeroCheckbox
      {...heroProps}
      classNames={{
        base: "m-0 p-0",
        hiddenInput: "peer",
        icon: "text-current",
        wrapper: cn(
          "size-4 shrink-0 rounded border border-input bg-card text-primary-foreground outline-none transition-colors",
          "group-data-[selected=true]:border-primary group-data-[selected=true]:bg-primary",
          "group-data-[focus-visible=true]:ring-2 group-data-[focus-visible=true]:ring-ring/20",
          "group-data-[disabled=true]:cursor-not-allowed group-data-[disabled=true]:opacity-60",
          className
        )
      }}
      data-slot="checkbox"
      defaultSelected={defaultChecked}
      icon={<Check aria-hidden className="size-3" />}
      isDisabled={disabled}
      isSelected={checked}
      onValueChange={onCheckedChange}
      radius="sm"
    />
  );
}
