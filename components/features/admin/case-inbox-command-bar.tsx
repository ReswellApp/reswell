"use client"

import { CheckCircle2, Clock3, UserCheck, UserRound } from "lucide-react"
import type { CaseInboxItem, CaseInboxPriority } from "@/lib/admin/case-inbox"
import type { SupportCaseStatus } from "@/lib/types/supportCase"
import { staffWorkflowStatusLabel } from "@/lib/admin/case-inbox-counterpart"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface CaseInboxCommandBarProps {
  item: CaseInboxItem
  currentStaffId: string | null
  assigneeName: string | null
  pending: boolean
  onTake: () => void
  onStatus: (status: SupportCaseStatus) => void
  onPriority: (priority: CaseInboxPriority) => void
  onResolve: () => void
}

const WORKFLOW_STATUS_VALUES: SupportCaseStatus[] = [
  "submitted",
  "in_review",
  "in_progress",
  "waiting_on_you",
  "resolved",
]

export function CaseInboxCommandBar({
  item,
  currentStaffId,
  assigneeName,
  pending,
  onTake,
  onStatus,
  onPriority,
  onResolve,
}: CaseInboxCommandBarProps) {
  const assignedToMe =
    currentStaffId !== null && item.assigneeAdminId === currentStaffId

  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/50 bg-muted/10 px-4 py-2.5"
      aria-label="Case workflow"
    >
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Workflow
      </span>

      <span className="hidden text-[11px] text-muted-foreground sm:inline">Status</span>
      <Select value={item.status} onValueChange={(value) => onStatus(value as SupportCaseStatus)} disabled={pending}>
        <SelectTrigger className="h-8 w-[168px] bg-background text-xs" aria-label="Case status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {WORKFLOW_STATUS_VALUES.map((status) => (
            <SelectItem key={status} value={status}>
              {staffWorkflowStatusLabel(status, item)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="hidden text-[11px] text-muted-foreground sm:inline">Priority</span>
      <Select value={item.priority} onValueChange={(value) => onPriority(value as CaseInboxPriority)} disabled={pending}>
        <SelectTrigger className="h-8 w-[105px] bg-background text-xs capitalize" aria-label="Case priority">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="low">Low</SelectItem>
          <SelectItem value="normal">Normal</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="urgent">Urgent</SelectItem>
        </SelectContent>
      </Select>

      {assignedToMe ? (
        <span className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border border-border/60 bg-background px-2 text-[11px] text-muted-foreground">
          <UserRound className="h-3.5 w-3.5" aria-hidden />
          Assigned to you
        </span>
      ) : item.assigneeAdminId ? (
        <span className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border border-border/60 bg-background px-2 text-[11px] text-muted-foreground">
          <UserRound className="h-3.5 w-3.5" aria-hidden />
          {assigneeName ?? "Assigned"}
        </span>
      ) : null}

      {currentStaffId && !assignedToMe ? (
        <Button type="button" size="sm" variant="outline" className={item.assigneeAdminId ? "h-8" : "ml-auto h-8"} disabled={pending} onClick={onTake}>
          <UserCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          {item.assigneeAdminId ? "Take over" : "Assign to me"}
        </Button>
      ) : null}

      <span
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md border border-border/60 bg-background px-2 text-[11px] font-medium",
          item.slaState === "overdue"
            ? "border-destructive/30 text-destructive"
            : item.slaState === "due_soon"
              ? "border-amber-500/30 text-amber-700 dark:text-amber-300"
              : "text-muted-foreground",
        )}
      >
        <Clock3 className="h-3.5 w-3.5" aria-hidden />
        {item.isOpen ? item.slaLabel || "SLA on track" : "Closed"}
      </span>

      {item.isOpen ? (
        <Button type="button" size="sm" className="h-8" disabled={pending} onClick={onResolve}>
          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Resolve
        </Button>
      ) : null}
    </div>
  )
}
