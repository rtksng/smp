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
  ghost: "bg-transparent text-[#12314f] hover:bg-[#edf6ff]",
  outline:
    "border-[#b9d6f2] bg-white !text-[#0b5cab] shadow-sm shadow-[#0b5cab]/5 hover:border-[#0b5cab] hover:bg-[#f4f9ff] hover:shadow-md hover:shadow-[#0b5cab]/10",
  primary:
    "bg-[#0b5cab] text-white shadow-sm shadow-[#0b5cab]/20 hover:bg-[#094f94] hover:shadow-md hover:shadow-[#0b5cab]/25",
  secondary:
    "border-[#cfe4f8] bg-[#eaf4ff] text-[#0b5cab] shadow-sm shadow-[#0b5cab]/5 hover:bg-[#dcedff] hover:shadow-md hover:shadow-[#0b5cab]/10"
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
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-transparent px-5 py-2 text-sm font-bold transition duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-[#0b5cab] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0",
    variantClasses[variant],
    className
  ]
    .filter(Boolean)
    .join(" ");
}

function isLinkButton(props: ButtonProps): props is ButtonAsLinkProps {
  return typeof props.href === "string";
}
