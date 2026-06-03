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
  SelectItem as HeroSelectItem
} from "@heroui/select";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

type SelectItemData = {
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  value: string;
};

type SelectContextData = {
  items: SelectItemData[];
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

      data.items.push({
        children: props.children,
        className: props.className,
        disabled: props.disabled,
        value: props.value
      });
    }
  });
}

export function Select({ children, disabled, onValueChange, value }: SelectProps) {
  const data: SelectContextData = { items: [] };

  collectSelectData(children, data);

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
      {data.items.map((item) => (
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
