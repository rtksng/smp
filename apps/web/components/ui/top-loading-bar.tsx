type TopLoadingBarState = "idle" | "loading" | "settling";

type TopLoadingBarProps = {
  label?: string;
  state?: TopLoadingBarState;
};

export function TopLoadingBar({
  label = "Page transition loading",
  state = "loading"
}: TopLoadingBarProps) {
  const isVisible = state !== "idle";

  return (
    <div
      aria-label={label}
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[80] h-1 overflow-hidden"
      data-state={state}
      role="status"
    >
      <span
        aria-hidden="true"
        className={[
          "absolute inset-x-0 top-0 h-px bg-[#c7eacb] transition-opacity duration-150",
          isVisible ? "opacity-100" : "opacity-0"
        ].join(" ")}
      />
      <span
        aria-hidden="true"
        className={[
          "route-progress-bar absolute left-0 top-0 h-full w-full bg-[linear-gradient(90deg,transparent,#287c30_18%,#287c30_52%,#8edb93_86%,transparent)] shadow-[0_0_18px_rgba(40,124,48,0.7)] transition-opacity duration-150",
          isVisible ? "opacity-100" : "opacity-0"
        ].join(" ")}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
