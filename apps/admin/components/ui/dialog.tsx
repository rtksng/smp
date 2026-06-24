"use client";

import {
  cloneElement,
  createContext,
  Fragment,
  isValidElement,
  useContext,
  useId,
  type ComponentProps,
  type MouseEvent,
  type ReactElement,
  type ReactNode
} from "react";
import {
  Modal as HeroModal,
  ModalContent as HeroModalContent,
  type ModalContentProps as HeroModalContentProps
} from "@heroui/modal";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type DialogContextValue = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type DialogContentContextValue = {
  descriptionId: string;
  titleId: string;
};

const DialogContext = createContext<DialogContextValue>({});
const DialogContentContext = createContext<DialogContentContextValue | null>(null);

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
  children,
  className,
  onClick,
  ...props
}: ComponentProps<"button"> & { children?: ReactNode }) {
  const { onOpenChange } = useContext(DialogContext);

  if (!isValidElement(children)) {
    return null;
  }

  const child = children as ReactElement<{
    className?: string;
    onClick?: (event: MouseEvent<HTMLElement>) => void;
  }>;

  return cloneElement(child, {
    ...props,
    className: cn(className, child.props.className),
    onClick: (event: MouseEvent<HTMLElement>) => {
      child.props.onClick?.(event);

      if (!event.defaultPrevented) {
        onClick?.(event as MouseEvent<HTMLButtonElement>);
      }

      if (!event.defaultPrevented) {
        onOpenChange?.(true);
      }
    }
  } as Partial<{
    className: string;
    onClick: (event: MouseEvent<HTMLElement>) => void;
  }>);
}

export function DialogClose({
  children,
  className,
  ...props
}: ComponentProps<"button">) {
  const { onOpenChange } = useContext(DialogContext);

  return (
    <button
      {...props}
      className={className}
      data-slot="dialog-close"
      onClick={(event) => {
        props.onClick?.(event);

        if (!event.defaultPrevented) {
          onOpenChange?.(false);
        }
      }}
      type={props.type ?? "button"}
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

type DialogContentProps = ComponentProps<"div"> & {
  hideCloseButton?: boolean;
  isDismissable?: boolean;
  isKeyboardDismissDisabled?: boolean;
};

export function DialogContent({
  children,
  className,
  hideCloseButton = false,
  isDismissable,
  isKeyboardDismissDisabled,
  ...props
}: DialogContentProps) {
  const { open = false, onOpenChange } = useContext(DialogContext);
  const generatedId = useId();
  const titleId = `${generatedId}-title`;
  const descriptionId = `${generatedId}-description`;
  const contentProps = props as Omit<
    HeroModalContentProps,
    "children" | "className"
  >;
  const labelledBy = props["aria-labelledby"] ?? titleId;
  const describedBy = props["aria-describedby"] ?? descriptionId;

  return (
    <HeroModal
      classNames={{
        backdrop: "z-40 bg-black/45 adminDialogBackdrop",
        base: cn(
          "z-50 grid w-[calc(100%-32px)] max-w-[520px] gap-4 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-2xl outline-none adminDialogPanel",
          className
        ),
        closeButton: "hidden",
        wrapper: "adminDialogWrapper"
      }}
      data-slot="dialog-content"
      hideCloseButton
      isDismissable={isDismissable}
      isKeyboardDismissDisabled={isKeyboardDismissDisabled}
      isOpen={open}
      onOpenChange={onOpenChange}
      placement="center"
      radius="sm"
      scrollBehavior="inside"
    >
      <HeroModalContent
        {...contentProps}
        aria-describedby={describedBy}
        aria-labelledby={labelledBy}
        data-slot="dialog-content-panel"
      >
        <DialogContentContext.Provider value={{ descriptionId, titleId }}>
          {children}
          {hideCloseButton ? null : (
            <DialogClose className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
              <X aria-hidden className="size-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          )}
        </DialogContentContext.Provider>
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

export function DialogTitle({ className, id, ...props }: ComponentProps<"h2">) {
  const contentContext = useContext(DialogContentContext);

  return (
    <h2
      className={cn("text-xl font-bold text-foreground", className)}
      data-slot="dialog-title"
      id={id ?? contentContext?.titleId}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  id,
  ...props
}: ComponentProps<"p">) {
  const contentContext = useContext(DialogContentContext);

  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      data-slot="dialog-description"
      id={id ?? contentContext?.descriptionId}
      {...props}
    />
  );
}
