import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  className?: string;
  eyebrow?: ReactNode;
  level?: 1 | 2 | 3;
  summary?: ReactNode;
  title: ReactNode;
};

export function PageHeader({
  actions,
  backHref,
  backLabel = "Back to list",
  className,
  eyebrow,
  level = 1,
  title
}: PageHeaderProps) {
  const Heading = `h${level}` as const;
  const eyebrowText = eyebrow ? <p className="eyebrow">{eyebrow}</p> : null;

  return (
    <header className={cn("adminPageHeader", className)}>
      <div>
        {backHref ? (
          <div className="adminPageHeaderEyebrowRow flex flex-row items-center gap-2">
            <Link
              aria-label={backLabel}
              className="adminPageHeaderBack"
              href={backHref}
              title={backLabel}
            >
              <ArrowLeft aria-hidden size={16} />
            </Link>
            {eyebrowText}
          </div>
        ) : (
          eyebrowText
        )}
        <Heading className="adminPageHeaderTitle hidden sm:block">{title}</Heading>
      </div>
      {actions ? <div className="adminPageActions">{actions}</div> : null}
    </header>
  );
}
