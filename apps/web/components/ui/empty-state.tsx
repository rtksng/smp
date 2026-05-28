import type { ReactNode } from "react";

type EmptyStateProps = {
  action?: ReactNode;
  description: string;
  title: string;
};

export function EmptyState({ action, description, title }: EmptyStateProps) {
  return (
    <div className="grid min-h-48 place-items-center rounded-lg border border-dashed border-[#cfdcda] bg-white p-8 text-center">
      <div className="max-w-md">
        <h3 className="text-lg font-extrabold text-[#17211f]">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-[#687773]">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}
