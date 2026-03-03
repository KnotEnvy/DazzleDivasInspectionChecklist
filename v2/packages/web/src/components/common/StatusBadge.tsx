import { Badge } from "@/components/ui/Badge";

interface StatusBadgeProps {
  status: string;
}

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "default" | "info" }> = {
  COMPLETED: { label: "Completed", variant: "success" },
  IN_PROGRESS: { label: "In Progress", variant: "warning" },
  PENDING: { label: "Pending", variant: "default" },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, variant: "default" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
