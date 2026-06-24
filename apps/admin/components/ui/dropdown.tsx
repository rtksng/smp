"use client";

import {
  Dropdown as HeroDropdown,
  DropdownItem,
  DropdownMenu as HeroDropdownMenu,
  DropdownSection,
  DropdownTrigger,
  type DropdownMenuProps,
  type DropdownProps
} from "@heroui/dropdown";
import { cn } from "@/lib/utils";

export function Dropdown({
  classNames,
  placement = "bottom-end",
  shouldBlockScroll = false,
  ...props
}: DropdownProps) {
  return (
    <HeroDropdown
      {...props}
      classNames={{
        ...classNames,
        base: cn("adminDropdownBase", classNames?.base),
        content: cn("adminDropdownContent", classNames?.content)
      }}
      placement={placement}
      shouldBlockScroll={shouldBlockScroll}
    />
  );
}

export function DropdownMenu<T extends object>({
  classNames,
  itemClasses,
  ...props
}: DropdownMenuProps<T>) {
  return (
    <HeroDropdownMenu
      {...props}
      classNames={{
        ...classNames,
        base: cn("adminDropdownMenu", classNames?.base)
      }}
      itemClasses={{
        ...itemClasses,
        base: cn("adminDropdownItem", itemClasses?.base),
        title: cn("adminDropdownItemTitle", itemClasses?.title)
      }}
    />
  );
}

export { DropdownItem, DropdownSection, DropdownTrigger };
