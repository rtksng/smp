import type { ReactNode } from "react";

type EmptyStateProps = {
  action?: ReactNode;
  description: string;
  title: string;
};

export function EmptyState({ action, description, title }: EmptyStateProps) {
  return (
    <div className="grid min-h-48 place-items-center rounded-[1.25rem] border border-dashed border-[#c4e4e0] bg-white p-8 text-center shadow-sm shadow-[#0f6f68]/5">
      <div className="max-w-md">
        <h3 className="text-lg font-semibold text-[#123f3c]">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-[#55716e]">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}
