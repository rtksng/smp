"use client";

import type { ComponentProps } from "react";
import { Switch as HeroSwitch } from "@heroui/switch";

export type SwitchProps = Omit<
  ComponentProps<typeof HeroSwitch>,
  "isSelected" | "onValueChange"
> & {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

export function Switch({ checked, onCheckedChange, ...props }: SwitchProps) {
  return (
    <HeroSwitch
      data-slot="switch"
      isSelected={checked}
      onValueChange={onCheckedChange}
      {...props}
    />
  );
}
