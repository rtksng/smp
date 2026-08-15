import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "outline";

type ButtonBaseProps = {
  children: ReactNode;
  className?: string;
  variant?: ButtonVariant;
};

type ButtonAsLinkProps = ButtonBaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
  };

type ButtonAsButtonProps = ButtonBaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
    href?: undefined;
    type?: "button" | "reset" | "submit";
  };

export type ButtonProps = ButtonAsLinkProps | ButtonAsButtonProps;

const variantClasses: Record<ButtonVariant, string> = {
  ghost: "bg-transparent text-[#123f3c] hover:bg-[#e5f5f3]",
  outline:
    "border-[#9fd7d1] bg-white !text-[#0f6f68] shadow-sm shadow-[#0f6f68]/5 hover:border-[#0f6f68] hover:bg-[#f3faf9] hover:shadow-md hover:shadow-[#0f6f68]/10",
  primary:
    "bg-[#0f6f68] text-white shadow-sm shadow-[#0f6f68]/20 hover:bg-[#0b5e59] hover:shadow-md hover:shadow-[#0f6f68]/25",
  secondary:
    "border-[#b8e3de] bg-[#e3f5f2] text-[#0f6f68] shadow-sm shadow-[#0f6f68]/5 hover:bg-[#d8f1ee] hover:shadow-md hover:shadow-[#0f6f68]/10"
};

export function Button(props: ButtonProps) {
  if (isLinkButton(props)) {
    const { children, className, href, variant = "primary", ...anchorProps } = props;

    return (
      <a className={buttonClassName(variant, className)} href={href} {...anchorProps}>
        {children}
      </a>
    );
  }

  const {
    children,
    className,
    type = "button",
    variant = "primary",
    ...buttonProps
  } = props;

  return (
    <button
      className={buttonClassName(variant, className)}
      type={type}
      {...buttonProps}
    >
      {children}
    </button>
  );
}

function buttonClassName(variant: ButtonVariant, className?: string) {
  return [
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-transparent px-5 py-2 text-sm font-semibold transition duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-[#0f6f68] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0",
    variantClasses[variant],
    className
  ]
    .filter(Boolean)
    .join(" ");
}

function isLinkButton(props: ButtonProps): props is ButtonAsLinkProps {
  return typeof props.href === "string";
}
