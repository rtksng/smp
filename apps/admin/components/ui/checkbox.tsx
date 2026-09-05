"use client";

import type { ComponentProps } from "react";
import {
  Checkbox as HeroCheckbox,
  type CheckboxProps as HeroCheckboxProps
} from "@heroui/checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type CheckboxProps = Omit<ComponentProps<"input">, "onChange" | "type"> & {
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

export function Checkbox({
  checked,
  className,
  defaultChecked,
  disabled,
  indeterminate,
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
      icon={({ className: iconClassName, isSelected, isIndeterminate }) => {
        const Icon = isIndeterminate ? Minus : Check;
        return (
          <Icon
            aria-hidden
            className={cn(iconClassName, "size-3")}
            strokeWidth={3}
            style={{
              color: "#fff",
              margin: 0,
              opacity: isSelected || isIndeterminate ? 1 : 0,
              width: 12,
              height: 12
            }}
          />
        );
      }}
      isDisabled={disabled}
      isIndeterminate={indeterminate}
      isSelected={checked}
      onValueChange={onCheckedChange}
      radius="sm"
    />
  );
}
