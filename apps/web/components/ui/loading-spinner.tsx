type LoadingSpinnerProps = {
  className?: string;
  label?: string;
};

export function LoadingSpinner({ className, label = "Loading" }: LoadingSpinnerProps) {
  return (
    <div
      className={[
        "flex min-h-48 items-center justify-center gap-3 rounded-lg border border-[#d8e2df] bg-white p-8 text-sm font-bold text-[#687773]",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#cfdcda] border-t-[#006d77]" />
      <span>{label}</span>
    </div>
  );
}

export function PageLoader({ label = "Loading page" }: LoadingSpinnerProps) {
  return (
    <div className="grid min-h-[60vh] place-items-center bg-[#f5f8f7] px-4 py-8">
      <LoadingSpinner className="w-full max-w-xl" label={label} />
    </div>
  );
}

export function SectionLoader({ label = "Loading section" }: LoadingSpinnerProps) {
  return <LoadingSpinner label={label} />;
}
