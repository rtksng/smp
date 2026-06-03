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
      value: string;
    }
  | {
      children?: ReactNode;
      className?: string;
      key: string;
      kind: "label";
      title?: string;
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
        title: getTextContent(props.children)
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

function getTextContent(node: ReactNode): string | undefined {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    const text = node.map(getTextContent).filter(Boolean).join(" ");

    return text || undefined;
  }

  return undefined;
}

function renderSelectEntries(entries: SelectEntry[]): ReactElement[] {
  const renderedEntries: ReactElement[] = [];
  let pendingSection:
    | {
        className?: string;
        items: Extract<SelectEntry, { kind: "item" }>[];
        key: string;
        title?: string;
      }
    | null = null;

  function flushSection() {
    if (!pendingSection) {
      return;
    }

    renderedEntries.push(
      <HeroSelectSection
        key={pendingSection.key}
        className={cn("py-1", pendingSection.className)}
        showDivider
        title={pendingSection.title}
      >
        {pendingSection.items.map((item) => (
          <HeroSelectItem
            key={item.value}
            className={cn(
              "rounded-md text-sm text-foreground data-[hover=true]:bg-muted",
              item.className
            )}
            data-slot="select-item"
            isDisabled={item.disabled}
          >
            {item.children}
          </HeroSelectItem>
        ))}
      </HeroSelectSection>
    );
    pendingSection = null;
  }

  for (const entry of entries) {
    if (entry.kind === "label") {
      flushSection();
      pendingSection = {
        className: entry.className,
        items: [],
        key: entry.key,
        title: entry.title
      };
      continue;
    }

    if (entry.kind === "separator") {
      flushSection();
      pendingSection = {
        className: entry.className,
        items: [],
        key: entry.key
      };
      continue;
    }

    if (pendingSection) {
      pendingSection.items.push(entry);
      continue;
    }

    renderedEntries.push(
      <HeroSelectItem
        key={entry.value}
        className={cn(
          "rounded-md text-sm text-foreground data-[hover=true]:bg-muted",
          entry.className
        )}
        data-slot="select-item"
        isDisabled={entry.disabled}
      >
        {entry.children}
      </HeroSelectItem>
    );
  }

  flushSection();

  return renderedEntries;
}

export function Select({ children, disabled, onValueChange, value }: SelectProps) {
  const data: SelectContextData = { entries: [] };

  collectSelectData(children, data);
  const selectChildren = renderSelectEntries(data.entries) as unknown as HeroSelectProps["children"];

  return (
    <HeroSelect
      aria-label={data.placeholder ?? "Select option"}
      classNames={{
        trigger: cn(
          "flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors shadow-none",
          "data-[focus=true]:border-ring data-[focus=true]:ring-2 data-[focus=true]:ring-ring/20",
          "data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-60",
          data.triggerClassName
        ),
        value: "text-foreground group-data-[has-value=false]:text-muted-foreground"
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
      selectorIcon={<ChevronDown aria-hidden className="size-4 opacity-70" />}
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
      className={cn("px-2 py-1.5 text-xs font-bold text-muted-foreground", className)}
      data-slot="select-label"
      {...props}
    />
  );
}

type SelectItemProps = Omit<ComponentProps<"div">, "value"> & {
  disabled?: boolean;
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
