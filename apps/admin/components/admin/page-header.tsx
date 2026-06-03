import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  actions?: ReactNode;
  className?: string;
  eyebrow?: ReactNode;
  summary?: ReactNode;
  title: ReactNode;
};

export function PageHeader({
  actions,
  className,
  eyebrow,
  summary,
  title
}: PageHeaderProps) {
  return (
    <header className={cn("adminPageHeader", className)}>
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {summary ? <p className="panelSummary">{summary}</p> : null}
      </div>
      {actions ? <div className="adminPageActions">{actions}</div> : null}
    </header>
  );
}
