import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode
} from "react";

type ButtonBaseProps = {
  children: ReactNode;
  className?: string;
  variant?: "primary" | "secondary";
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

function buttonClassName(variant: ButtonBaseProps["variant"], className?: string) {
  return ["sp-button", `sp-button--${variant ?? "primary"}`, className]
    .filter(Boolean)
    .join(" ");
}

function isLinkButton(props: ButtonProps): props is ButtonAsLinkProps {
  return typeof props.href === "string";
}

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
