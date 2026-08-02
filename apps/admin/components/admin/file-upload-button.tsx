import type { InputHTMLAttributes, ReactNode } from "react";
import { buttonVariants, heroButtonClassName } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FileUploadButtonProps = {
  children: ReactNode;
  className?: string;
  inputProps: InputHTMLAttributes<HTMLInputElement>;
};

export function FileUploadButton({
  children,
  className,
  inputProps
}: FileUploadButtonProps) {
  return (
    <label
      className={cn(
        buttonVariants({ variant: "secondary" }),
        heroButtonClassName,
        "fileUploadButton",
        "relative cursor-pointer",
        className
      )}
    >
      {children}
      <input {...inputProps} className="absolute h-px w-px opacity-0" type="file" />
    </label>
  );
}
