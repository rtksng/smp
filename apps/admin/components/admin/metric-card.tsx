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
      <CardContent className="p-5">
        <span className="block text-sm font-bold text-muted-foreground">{label}</span>
        <strong className="mt-5 block text-3xl text-foreground">{value}</strong>
      </CardContent>
    </Card>
  );
}
