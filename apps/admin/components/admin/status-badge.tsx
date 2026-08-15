import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusToneClassName: Record<string, string> = {
  accepted: "bg-[#e5f5f3] text-[#0b5e59]",
  active: "bg-[#d8f1ee] text-[#0f6f68]",
  assigned: "bg-[#fff4dc] text-[#8a4b00]",
  authorized: "bg-[#e5f5f3] text-[#0b5e59]",
  blocked: "bg-[#fee2e2] text-[#991b1b]",
  cancelled: "bg-[#fee2e2] text-[#991b1b]",
  confirmed: "bg-[#d8f1ee] text-[#0f6f68]",
  created: "bg-[#e5f5f3] text-[#0b5e59]",
  delivered: "bg-[#d8f1ee] text-[#0f6f68]",
  draft: "bg-[#edf2f7] text-[#344054]",
  failed: "bg-[#fee2e2] text-[#991b1b]",
  inactive: "bg-[#f3f4f6] text-[#4b5563]",
  hidden: "bg-[#f3f4f6] text-[#4b5563]",
  out_for_delivery: "bg-[#fff4dc] text-[#8a4b00]",
  out_of_stock: "bg-[#fff4dc] text-[#8a4b00]",
  packed: "bg-[#fff4dc] text-[#8a4b00]",
  paid: "bg-[#d8f1ee] text-[#0f6f68]",
  partially_refunded: "bg-[#fee2e2] text-[#991b1b]",
  pending: "bg-[#e5f5f3] text-[#0b5e59]",
  pending_review: "bg-[#e5f5f3] text-[#0b5e59]",
  pending_verification: "bg-[#e5f5f3] text-[#0b5e59]",
  picked_up: "bg-[#e5f5f3] text-[#0b5e59]",
  published: "bg-[#d8f1ee] text-[#0f6f68]",
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
