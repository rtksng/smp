import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusToneClassName: Record<string, string> = {
  accepted: "bg-[#eef2ff] text-[#3730a3]",
  active: "bg-[#d8f3dc] text-[#1b5e20]",
  assigned: "bg-[#fff4dc] text-[#8a4b00]",
  authorized: "bg-[#eef2ff] text-[#3730a3]",
  cancelled: "bg-[#fee2e2] text-[#991b1b]",
  confirmed: "bg-[#d8f3dc] text-[#1b5e20]",
  created: "bg-[#eef2ff] text-[#3730a3]",
  delivered: "bg-[#dcfce7] text-[#166534]",
  draft: "bg-[#edf2f7] text-[#344054]",
  failed: "bg-[#fee2e2] text-[#991b1b]",
  inactive: "bg-[#f3f4f6] text-[#4b5563]",
  out_for_delivery: "bg-[#fff4dc] text-[#8a4b00]",
  out_of_stock: "bg-[#fff4dc] text-[#8a4b00]",
  packed: "bg-[#fff4dc] text-[#8a4b00]",
  paid: "bg-[#d8f3dc] text-[#1b5e20]",
  partially_refunded: "bg-[#fee2e2] text-[#991b1b]",
  pending: "bg-[#eef2ff] text-[#3730a3]",
  pending_verification: "bg-[#eef2ff] text-[#3730a3]",
  picked_up: "bg-[#eef2ff] text-[#3730a3]",
  refunded: "bg-[#fee2e2] text-[#991b1b]",
  returned: "bg-[#fee2e2] text-[#991b1b]",
  suspended: "bg-[#fee2e2] text-[#991b1b]"
};

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();

  return (
    <Badge
      className={cn(
        "capitalize",
        statusToneClassName[normalized] ?? "bg-muted text-muted-foreground"
      )}
    >
      {normalized.replaceAll("_", " ")}
    </Badge>
  );
}
