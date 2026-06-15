type LoadingSpinnerProps = {
  className?: string;
  label?: string;
};

export function LoadingSpinner({ className, label = "Loading" }: LoadingSpinnerProps) {
  return (
    <div
      className={[
        "flex min-h-48 items-center justify-center gap-3 rounded-[1.25rem] border border-[#d6e7f8] bg-white p-8 text-sm font-bold text-[#52677f] shadow-sm shadow-[#0b5cab]/5",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#b9d6f2] border-t-[#0b5cab]" />
      <span>{label}</span>
    </div>
  );
}

export function PageLoader({ label = "Loading page" }: LoadingSpinnerProps) {
  return (
    <div className="grid min-h-[60vh] place-items-center bg-[#f4f9ff] px-4 py-8">
      <LoadingSpinner className="w-full max-w-xl" label={label} />
    </div>
  );
}

export function SectionLoader({ label = "Loading section" }: LoadingSpinnerProps) {
  return <LoadingSpinner label={label} />;
}
