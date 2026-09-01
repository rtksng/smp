"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      closeButton
      position="top-right"
      richColors
      toastOptions={{
        classNames: {
          description: "adminToastDescription",
          title: "adminToastTitle",
          toast: "adminToast"
        }
      }}
    />
  );
}
