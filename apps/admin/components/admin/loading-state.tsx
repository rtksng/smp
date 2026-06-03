import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type LoadingStateProps = {
  className?: string;
  label?: ReactNode;
};

export function LoadingState({ className, label = "Loading..." }: LoadingStateProps) {
  return (
    <Card className={cn("adminLoadingState", className)}>
      <CardContent>
        <Spinner size="sm" />
        <span>{label}</span>
      </CardContent>
    </Card>
  );
}
