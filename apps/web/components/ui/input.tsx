import type { InputHTMLAttributes, ReactNode } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  icon?: ReactNode;
  label?: string;
};

export function Input({ className, error, icon, id, label, ...props }: InputProps) {
  const inputId = id ?? props.name;

  return (
    <label className="grid gap-2 text-sm font-semibold text-[#123f3c]" htmlFor={inputId}>
      {label ? <span>{label}</span> : null}
      <span className="relative block">
        {icon ? (
          <span className="pointer-events-none absolute left-4 top-1/2 flex -translate-y-1/2 text-[#55716e]">
            {icon}
          </span>
        ) : null}
        <input
          className={[
            "min-h-12 w-full rounded-full border border-[#9fd7d1] bg-white px-5 text-base text-[#123f3c] outline-none transition focus:border-[#0f6f68] focus:ring-2 focus:ring-[#0f6f68]/20",
            icon ? "pl-12" : "",
            error
              ? "border-[#b42318] focus:border-[#b42318] focus:ring-[#b42318]/15"
              : "",
            className
          ]
            .filter(Boolean)
            .join(" ")}
          id={inputId}
          {...props}
        />
      </span>
      {error ? (
        <span className="text-sm font-semibold text-[#b42318]">{error}</span>
      ) : null}
    </label>
  );
}
