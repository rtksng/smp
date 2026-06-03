import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

type EmptyStateProps = {
  action?: ReactNode;
  body: string;
  title: string;
};

export function EmptyState({
  action,
  body,
  title
}: EmptyStateProps) {
  return (
    <Card className="adminEmptyState">
      <CardContent>
        <strong>{title}</strong>
        <p>{body}</p>
        {action ? <div className="adminPageActions">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
