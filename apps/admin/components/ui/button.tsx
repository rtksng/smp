import {
  cloneElement,
  isValidElement,
  type ComponentPropsWithoutRef,
  type MouseEvent,
  type ReactElement
} from "react";
import {
  Button as HeroButton,
  type ButtonProps as HeroButtonProps
} from "@heroui/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-60 [&_span]:!text-current [&_svg]:!text-current [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    defaultVariants: {
      size: "default",
      variant: "default"
    },
    variants: {
      size: {
        default: "px-4 py-2",
        icon: "size-10 p-0",
        sm: "min-h-9 px-3 py-2"
      },
      variant: {
        default: "bg-primary !text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive !text-destructive-foreground hover:bg-destructive/90",
        ghost: "bg-transparent !text-foreground hover:bg-muted",
        outline:
          "border border-border bg-card !text-foreground hover:bg-muted",
        secondary:
          "bg-secondary !text-secondary-foreground hover:bg-secondary/90"
      }
    }
  }
);

export const heroButtonClassName =
  "data-[hover=true]:opacity-100 data-[pressed=true]:scale-100";

export type ButtonProps = ComponentPropsWithoutRef<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({
  asChild = false,
  children,
  className,
  disabled,
  onClick,
  size,
  type = "button",
  value,
  variant,
  ...props
}: ButtonProps) {
  const mergedClassName = cn(
    buttonVariants({ className, size, variant }),
    heroButtonClassName
  );

  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{
      className?: string;
      onClick?: (event: MouseEvent<HTMLElement>) => void;
      tabIndex?: number;
    }>;
    const isNativeButtonChild = child.type === "button";
    const childProps = {
      ...props,
      className: cn(mergedClassName, child.props.className),
      onClick: (event: MouseEvent<HTMLElement>) => {
        if (disabled) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        onClick?.(event as MouseEvent<HTMLButtonElement>);

        if (!event.defaultPrevented) {
          child.props.onClick?.(event);
        }
      },
      "aria-disabled": disabled || undefined,
      "data-disabled": disabled ? "" : undefined,
      "data-slot": "button",
      tabIndex: disabled ? -1 : child.props.tabIndex
    } as Partial<{
      "aria-disabled": boolean;
      "data-disabled": string;
      "data-slot": string;
      className: string;
      disabled: boolean;
      onClick: (event: MouseEvent<HTMLElement>) => void;
      tabIndex: number;
      type: ComponentPropsWithoutRef<"button">["type"];
      value: ComponentPropsWithoutRef<"button">["value"];
    }>;

    if (isNativeButtonChild) {
      childProps.disabled = disabled;
      childProps.type = type;
      childProps.value = value;
    }

    return cloneElement(child, childProps);
  }

  const heroProps = props as Omit<
    HeroButtonProps,
    "children" | "className" | "isDisabled" | "onClick" | "radius" | "type" | "value"
  >;

  return (
    <HeroButton
      {...heroProps}
      className={mergedClassName}
      data-slot="button"
      isDisabled={disabled}
      onClick={(event) => {
        onClick?.(event as unknown as MouseEvent<HTMLButtonElement>);
      }}
      radius="sm"
      type={type}
      value={Array.isArray(value) ? value.join(",") : value?.toString()}
    >
      {children}
    </HeroButton>
  );
}
