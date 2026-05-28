import type { ReactNode } from "react";

type SectionHeaderProps = {
  action?: ReactNode;
  eyebrow?: string;
  title: string;
  description?: string;
};

export function SectionHeader({
  action,
  description,
  eyebrow,
  title
}: SectionHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="mb-2 text-xs font-extrabold uppercase text-[#9b6a1e]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-2xl font-extrabold leading-tight text-[#17211f] sm:text-3xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-3 text-base leading-7 text-[#687773]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
