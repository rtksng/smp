import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusToneClassName: Record<string, string> = {
  accepted: "bg-[#eaf7eb] text-[#23702a]",
  active: "bg-[#d8f3dc] text-[#1b5e20]",
  assigned: "bg-[#fff4dc] text-[#8a4b00]",
  authorized: "bg-[#eaf7eb] text-[#23702a]",
  blocked: "bg-[#fee2e2] text-[#991b1b]",
  cancelled: "bg-[#fee2e2] text-[#991b1b]",
  confirmed: "bg-[#d8f3dc] text-[#1b5e20]",
  created: "bg-[#eaf7eb] text-[#23702a]",
  delivered: "bg-[#dcfce7] text-[#166534]",
  draft: "bg-[#edf2f7] text-[#344054]",
  failed: "bg-[#fee2e2] text-[#991b1b]",
  inactive: "bg-[#f3f4f6] text-[#4b5563]",
  hidden: "bg-[#f3f4f6] text-[#4b5563]",
  out_for_delivery: "bg-[#fff4dc] text-[#8a4b00]",
  out_of_stock: "bg-[#fff4dc] text-[#8a4b00]",
  packed: "bg-[#fff4dc] text-[#8a4b00]",
  paid: "bg-[#d8f3dc] text-[#1b5e20]",
  partially_refunded: "bg-[#fee2e2] text-[#991b1b]",
  pending: "bg-[#eaf7eb] text-[#23702a]",
  pending_review: "bg-[#eaf7eb] text-[#23702a]",
  pending_verification: "bg-[#eaf7eb] text-[#23702a]",
  picked_up: "bg-[#eaf7eb] text-[#23702a]",
  published: "bg-[#d8f3dc] text-[#1b5e20]",
  rejected: "bg-[#fee2e2] text-[#991b1b]",
  refunded: "bg-[#fee2e2] text-[#991b1b]",
  returned: "bg-[#fee2e2] text-[#991b1b]",
  suspended: "bg-[#fee2e2] text-[#991b1b]"
};

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();

  return (
    <Badge
      className={cn(
        "statusBadge capitalize",
        statusToneClassName[normalized] ?? "bg-muted text-muted-foreground"
      )}
    >
      {normalized.replaceAll("_", " ")}
    </Badge>
  );
}
