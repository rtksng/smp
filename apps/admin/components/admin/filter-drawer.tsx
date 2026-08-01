"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type FilterDrawerProps = {
  applyLabel?: string;
  children: ReactNode;
  error?: string | null;
  isOpen: boolean;
  isSubmitting?: boolean;
  onApply: (event: FormEvent<HTMLFormElement>) => void;
  onOpenChange: (isOpen: boolean) => void;
  onReset?: () => void;
  resetLabel?: string;
  summary?: string;
  title?: string;
};

export function FilterDrawer({
  applyLabel = "Apply filters",
  children,
  error,
  isOpen,
  isSubmitting = false,
  onApply,
  onOpenChange,
  onReset,
  resetLabel = "Reset",
  title = "Filters"
}: FilterDrawerProps) {
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    drawerRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen, onOpenChange]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <div className="filterDrawerRoot">
          <motion.button
            aria-label="Close filters by clicking outside"
            animate={{ opacity: 1 }}
            className="filterDrawerBackdrop"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            transition={{ duration: 0.2 }}
            type="button"
          />
          <motion.aside
            aria-label={title}
            aria-modal="true"
            animate={{ x: 0 }}
            className="filterDrawerContent"
            exit={{ x: "100%" }}
            initial={{ x: "100%" }}
            ref={drawerRef}
            role="dialog"
            tabIndex={-1}
            transition={{ damping: 28, stiffness: 300, type: "spring" }}
          >
            <button
              aria-label="Close filters"
              className="filterDrawerCloseButton"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              <X aria-hidden size={18} strokeWidth={2.4} />
            </button>
            <form className="filterDrawerForm" onSubmit={onApply}>
              <div className="filterDrawerBody">
                {children}
                {error ? (
                  <p className="formError" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
              <footer className="filterDrawerFooter">
                {onReset ? (
                  <Button onClick={onReset} type="button" variant="outline">
                    {resetLabel}
                  </Button>
                ) : null}
                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Applying..." : applyLabel}
                </Button>
              </footer>
            </form>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
