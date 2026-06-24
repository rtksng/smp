"use client";

import {
  Children,
  isValidElement,
  type ComponentProps,
  type ReactElement,
  type ReactNode
} from "react";
import {
  Select as HeroSelect,
  type SelectProps as HeroSelectProps,
  SelectItem as HeroSelectItem,
  SelectSection as HeroSelectSection
} from "@heroui/select";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

type SelectEntry =
  | {
      children?: ReactNode;
      className?: string;
      disabled?: boolean;
      key: string;
      kind: "item";
      textValue?: string;
      value: string;
    }
  | {
      children?: ReactNode;
      className?: string;
      key: string;
      kind: "label";
      title?: ReactNode;
    }
  | {
      className?: string;
      key: string;
      kind: "separator";
    };

type SelectContextData = {
  entries: SelectEntry[];
  placeholder?: string;
  triggerClassName?: string;
};

type SelectProps = {
  "aria-label"?: string;
  "aria-labelledby"?: string;
  children?: ReactNode;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
  value?: string;
};

function collectSelectData(children: ReactNode, data: SelectContextData) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return;
    }

    if (child.type === SelectTrigger) {
      const props = child.props as SelectTriggerProps;

      data.triggerClassName = props.className;
      collectSelectData(props.children, data);
      return;
    }

    if (child.type === SelectValue) {
      const props = child.props as SelectValueProps;

      data.placeholder = props.placeholder;
      return;
    }

    if (child.type === SelectContent || child.type === SelectGroup) {
      const props = child.props as { children?: ReactNode };

      collectSelectData(props.children, data);
      return;
    }

    if (child.type === SelectItem) {
      const props = child.props as SelectItemProps;

      data.entries.push({
        key: props.value,
        kind: "item",
        children: props.children,
        className: props.className,
        disabled: props.disabled,
        textValue:
          props.textValue ??
          (typeof props.children === "string" ? props.children : undefined),
        value: props.value
      });
      return;
    }

    if (child.type === SelectLabel) {
      const props = child.props as ComponentProps<"div">;
      data.entries.push({
        className: props.className,
        key: `label-${data.entries.length}`,
        kind: "label",
        title: props.children
      });
      return;
    }

    if (child.type === SelectSeparator) {
      const props = child.props as ComponentProps<"div">;
      data.entries.push({
        className: props.className,
        key: `separator-${data.entries.length}`,
        kind: "separator"
      });
    }
  });
}

function renderSelectEntries(entries: SelectEntry[]): ReactElement[] {
  const renderedEntries: ReactElement[] = [];
  const groupedEntries: Array<{
    className?: string;
    items: Extract<SelectEntry, { kind: "item" }>[];
    key: string;
    showDivider: boolean;
    title?: ReactNode;
  }> = [];
  let pendingSection:
    | {
        className?: string;
        items: Extract<SelectEntry, { kind: "item" }>[];
        key: string;
        showDivider: boolean;
        title?: ReactNode;
      }
    | null = null;

  function ensureSection() {
    if (!pendingSection) {
      pendingSection = {
        items: [],
        key: `section-${groupedEntries.length}`,
        showDivider: false
      };
    }

    return pendingSection;
  }

  function flushSection() {
    if (!pendingSection) {
      return;
    }

    if (pendingSection.items.length > 0 || pendingSection.title) {
      groupedEntries.push(pendingSection);
    }

    pendingSection = null;
  }

  for (const entry of entries) {
    if (entry.kind === "label") {
      flushSection();
      pendingSection = {
        className: entry.className,
        items: [],
        key: entry.key,
        showDivider: false,
        title: entry.title
      };
      continue;
    }

    if (entry.kind === "separator") {
      const section = ensureSection();

      section.className = cn(section.className, entry.className);
      section.showDivider = true;
      flushSection();
      continue;
    }

    ensureSection().items.push(entry);
  }

  flushSection();

  const lastSection = groupedEntries.at(-1);

  if (lastSection) {
    lastSection.showDivider = false;
  }

  for (const section of groupedEntries) {
    renderedEntries.push(
      <HeroSelectSection
        key={section.key}
        className={cn("py-1", section.className)}
        showDivider={section.showDivider}
        title={section.title as never}
      >
        {section.items.map((item) => (
          <HeroSelectItem
            key={item.value}
            className={cn(
              "adminSelectItem rounded-md text-sm text-foreground data-[hover=true]:bg-muted",
              item.className
            )}
            data-slot="select-item"
            isDisabled={item.disabled}
            textValue={item.textValue}
          >
            {item.children}
          </HeroSelectItem>
        ))}
      </HeroSelectSection>
    );
  }

  return renderedEntries;
}

export function Select({
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  children,
  disabled,
  onValueChange,
  value
}: SelectProps) {
  const data: SelectContextData = { entries: [] };

  collectSelectData(children, data);
  const selectChildren = renderSelectEntries(data.entries) as unknown as HeroSelectProps["children"];

  return (
    <HeroSelect
      aria-label={ariaLabel ?? data.placeholder ?? "Select option"}
      aria-labelledby={ariaLabelledBy}
      classNames={{
        base: "w-full min-w-0",
        innerWrapper: "min-w-0 flex-1",
        listbox: "adminSelectListbox",
        listboxWrapper: "adminSelectListboxWrapper",
        mainWrapper: "w-full min-w-0",
        popoverContent: "adminSelectPopover z-[70]",
        selectorIcon: "right-3 size-4 shrink-0 opacity-70 pointer-events-none",
        trigger: cn(
          "relative flex min-h-10 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 py-2 pr-10 text-sm text-foreground outline-none transition-colors shadow-none",
          "data-[focus=true]:border-ring data-[focus=true]:ring-2 data-[focus=true]:ring-ring/20",
          "data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-60",
          data.triggerClassName
        ),
        value:
          "min-w-0 flex-1 truncate pr-1 text-left text-foreground group-data-[has-value=false]:text-muted-foreground"
      }}
      data-slot="select"
      isDisabled={disabled}
      onSelectionChange={(keys) => {
        if (keys === "all") {
          return;
        }

        const [nextValue] = Array.from(keys);

        if (nextValue !== undefined) {
          onValueChange?.(String(nextValue));
        }
      }}
      placeholder={data.placeholder}
      radius="sm"
      selectedKeys={value ? new Set([value]) : new Set()}
      selectorIcon={<ChevronDown aria-hidden className="size-4 shrink-0 opacity-70" />}
      variant="bordered"
    >
      {selectChildren}
    </HeroSelect>
  );
}

type SelectTriggerProps = ComponentProps<"button">;

export function SelectTrigger({ children }: SelectTriggerProps) {
  return <>{children}</>;
}

type SelectValueProps = {
  placeholder?: string;
};

export function SelectValue(_props: SelectValueProps) {
  return null;
}

export function SelectContent({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

export function SelectGroup({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

export function SelectLabel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("px-2 py-1.5 text-xs font-semibold text-muted-foreground", className)}
      data-slot="select-label"
      {...props}
    />
  );
}

type SelectItemProps = Omit<ComponentProps<"div">, "value"> & {
  disabled?: boolean;
  textValue?: string;
  value: string;
};

export function SelectItem(_props: SelectItemProps) {
  return null;
}

export function SelectSeparator({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      data-slot="select-separator"
      {...props}
    />
  );
}

export function SelectScrollUpButton({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex cursor-default items-center justify-center py-1", className)}
      data-slot="select-scroll-up-button"
      {...props}
    >
      <ChevronUp aria-hidden className="size-4" />
    </div>
  );
}

export function SelectScrollDownButton({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex cursor-default items-center justify-center py-1", className)}
      data-slot="select-scroll-down-button"
      {...props}
    >
      <ChevronDown aria-hidden className="size-4" />
    </div>
  );
}
