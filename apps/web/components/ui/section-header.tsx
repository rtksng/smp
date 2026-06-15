import type { ReactNode } from "react";

type SectionHeaderProps = {
  action?: ReactNode;
  eyebrow?: string;
  title: string;
  description?: string;
  size?: "default" | "compact";
};

export function SectionHeader({
  action,
  description,
  eyebrow,
  size = "default",
  title
}: SectionHeaderProps) {
  const isCompact = size === "compact";

  return (
    <div
      className={[
        isCompact ? "mb-4 gap-2" : "mb-8 gap-4",
        "flex flex-col md:flex-row md:items-end md:justify-between"
      ].join(" ")}
    >
      <div className="max-w-2xl">
        {eyebrow ? (
          <p
            className={[
              isCompact ? "mb-1 text-[11px]" : "mb-2 text-xs",
              "font-bold uppercase text-[#0b5cab]"
            ].join(" ")}
          >
            {eyebrow}
          </p>
        ) : null}
        <h2
          className={[
            isCompact ? "text-lg sm:text-xl" : "text-2xl sm:text-3xl",
            "font-bold leading-tight text-[#12314f]"
          ].join(" ")}
        >
          {title}
        </h2>
        {description ? (
          <p
            className={[
              isCompact ? "mt-2 text-sm leading-6" : "mt-3 text-base leading-7",
              "text-[#52677f]"
            ].join(" ")}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
