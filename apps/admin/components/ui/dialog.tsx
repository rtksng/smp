"use client";

import {
  cloneElement,
  createContext,
  Fragment,
  isValidElement,
  useContext,
  type ComponentProps,
  type ReactElement,
  type ReactNode
} from "react";
import {
  Modal as HeroModal,
  ModalContent as HeroModalContent
} from "@heroui/modal";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type DialogContextValue = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const DialogContext = createContext<DialogContextValue>({});

export type DialogProps = {
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function Dialog({ children, open, onOpenChange }: DialogProps) {
  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogTrigger({
  children
}: {
  children?: ReactNode;
}) {
  const { onOpenChange } = useContext(DialogContext);

  if (!isValidElement(children)) {
    return null;
  }

  const child = children as ReactElement<{ onClick?: () => void }>;

  return cloneElement(child, {
    onClick: () => {
      child.props.onClick?.();
      onOpenChange?.(true);
    }
  });
}

export function DialogClose({
  children,
  className,
  ...props
}: ComponentProps<"button">) {
  const { onOpenChange } = useContext(DialogContext);

  return (
    <button
      className={className}
      data-slot="dialog-close"
      onClick={(event) => {
        props.onClick?.(event);
        onOpenChange?.(false);
      }}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

export function DialogPortal({ children }: { children?: ReactNode }) {
  return <Fragment>{children}</Fragment>;
}

export function DialogOverlay({ className, ...props }: ComponentProps<"div">) {
  return <div className={className} data-slot="dialog-overlay" {...props} />;
}

export function DialogContent({
  children,
  className,
  ...props
}: ComponentProps<"div">) {
  const { open = false, onOpenChange } = useContext(DialogContext);

  return (
    <HeroModal
      classNames={{
        backdrop: "z-40 bg-black/45",
        base: cn(
          "z-50 grid w-[calc(100%-32px)] max-w-[520px] gap-4 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-2xl outline-none",
          className
        ),
        closeButton: "hidden"
      }}
      data-slot="dialog-content"
      isOpen={open}
      onOpenChange={onOpenChange}
      placement="center"
      radius="sm"
      scrollBehavior="inside"
    >
      <HeroModalContent data-slot="dialog-content-panel">
        {children}
        <DialogClose className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <X aria-hidden className="size-4" />
          <span className="sr-only">Close</span>
        </DialogClose>
      </HeroModalContent>
    </HeroModal>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("grid gap-2 text-left", className)}
      data-slot="dialog-header"
      {...props}
    />
  );
}

export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      data-slot="dialog-footer"
      {...props}
    />
  );
}

export function DialogTitle({ className, ...props }: ComponentProps<"h2">) {
  return (
    <h2
      className={cn("text-xl font-bold text-foreground", className)}
      data-slot="dialog-title"
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<"p">) {
  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      data-slot="dialog-description"
      {...props}
    />
  );
}
