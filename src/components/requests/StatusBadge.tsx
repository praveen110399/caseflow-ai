import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["request_status"];
type Priority = Database["public"]["Enums"]["request_priority"];

const statusStyles: Record<Status, string> = {
  draft: "bg-status-draft/10 text-status-draft border-status-draft/20",
  reviewed: "bg-status-reviewed/10 text-status-reviewed border-status-reviewed/20",
  approved: "bg-status-approved/10 text-status-approved border-status-approved/20",
  finalized: "bg-primary/10 text-primary border-primary/20",
};

const priorityStyles: Record<Priority, string> = {
  low: "bg-priority-low/10 text-priority-low border-priority-low/20",
  medium: "bg-priority-medium/10 text-priority-medium border-priority-medium/20",
  high: "bg-priority-high/10 text-priority-high border-priority-high/20",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge variant="outline" className={cn("capitalize font-medium", statusStyles[status])}>
      {status}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge variant="outline" className={cn("capitalize font-medium", priorityStyles[priority])}>
      {priority}
    </Badge>
  );
}
