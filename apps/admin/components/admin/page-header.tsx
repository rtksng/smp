import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  actions?: ReactNode;
  className?: string;
  eyebrow?: ReactNode;
  level?: 1 | 2 | 3;
  summary?: ReactNode;
  title: ReactNode;
};

export function PageHeader({
  actions,
  className,
  eyebrow,
  level = 1,
  summary,
  title
}: PageHeaderProps) {
  const Heading = `h${level}` as const;

  return (
    <header className={cn("adminPageHeader", className)}>
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <Heading>{title}</Heading>
        {summary ? <p className="panelSummary">{summary}</p> : null}
      </div>
      {actions ? <div className="adminPageActions">{actions}</div> : null}
    </header>
  );
}
