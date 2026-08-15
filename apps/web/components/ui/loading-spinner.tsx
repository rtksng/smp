import { TopLoadingBar } from "./top-loading-bar";

type LoadingSpinnerProps = {
  className?: string;
  label?: string;
};

export function LoadingSpinner({ className, label = "Loading" }: LoadingSpinnerProps) {
  return (
    <div
      className={[
        "flex min-h-48 items-center justify-center gap-3 rounded-[1.25rem] border border-[#c4e4e0] bg-white p-8 text-sm font-semibold text-[#55716e] shadow-sm shadow-[#0f6f68]/5",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#9fd7d1] border-t-[#0f6f68]" />
      <span>{label}</span>
    </div>
  );
}

export function PageLoader({ label = "Loading page" }: LoadingSpinnerProps) {
  return <TopLoadingBar label={label} state="loading" />;
}

export function SectionLoader({ label = "Loading section" }: LoadingSpinnerProps) {
  return <LoadingSpinner label={label} />;
}
