import type { ReactNode } from "react";

type EmptyStateProps = {
  action?: ReactNode;
  description: string;
  title: string;
};

export function EmptyState({ action, description, title }: EmptyStateProps) {
  return (
    <div className="grid min-h-48 place-items-center rounded-[1.25rem] border border-dashed border-[#cfe9d2] bg-white p-8 text-center shadow-sm shadow-[#287c30]/5">
      <div className="max-w-md">
        <h3 className="text-lg font-bold text-[#173b1d]">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-[#556b57]">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}
