import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  actions?: ReactNode;
  className?: string;
  description?: ReactNode;
  title: ReactNode;
};

export function EmptyState({
  actions,
  className,
  description,
  title
}: EmptyStateProps) {
  return (
    <Card className={cn("adminEmptyState", className)}>
      <CardContent>
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
        {actions ? <div className="adminPageActions">{actions}</div> : null}
      </CardContent>
    </Card>
  );
}
