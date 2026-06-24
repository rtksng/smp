import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: ReactNode;
  tone?: "primary" | "warning" | "neutral";
  value: ReactNode;
};

const toneClassName = {
  neutral: "border-t-[#63736f]",
  primary: "border-t-primary",
  warning: "border-t-warning"
};

export function MetricCard({ label, tone = "neutral", value }: MetricCardProps) {
  return (
    <Card className={cn("min-h-[132px] border-t-4", toneClassName[tone])}>
      <CardContent className="flex flex-col items-start p-5 text-left metricCardContent">
        <span className="block text-left text-sm font-semibold text-muted-foreground">
          {label}
        </span>
        <strong className="mt-5 block self-start text-left text-3xl text-foreground">
          {value}
        </strong>
      </CardContent>
    </Card>
  );
}
