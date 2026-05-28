import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode
} from "react";

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
  ghost: "bg-transparent text-[#17211f] hover:bg-[#eef3f1]",
  outline:
    "border-[#cfdcda] bg-white text-[#084c61] shadow-sm hover:border-[#006d77]",
  primary: "bg-[#006d77] text-white shadow-sm hover:bg-[#084c61]",
  secondary: "bg-[#233d4d] text-white shadow-sm hover:bg-[#17211f]"
};

export function Button(props: ButtonProps) {
  if (isLinkButton(props)) {
    const {
      children,
      className,
      href,
      variant = "primary",
      ...anchorProps
    } = props;

    return (
      <a
        className={buttonClassName(variant, className)}
        href={href}
        {...anchorProps}
      >
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
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-transparent px-4 py-2 text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-[#006d77] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
    variantClasses[variant],
    className
  ]
    .filter(Boolean)
    .join(" ");
}

function isLinkButton(props: ButtonProps): props is ButtonAsLinkProps {
  return typeof props.href === "string";
}
