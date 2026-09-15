"use client"

import { UserCheck } from "lucide-react"
import type { CaseInboxItem, CaseInboxPriority } from "@/lib/admin/case-inbox"
import type { SupportCaseStatus } from "@/lib/types/supportCase"
import type { StaffAssigneeRow } from "@/lib/db/searchInsightActions"
import { staffWorkflowStatusLabel } from "@/lib/admin/case-inbox-counterpart"
import { CaseAssigneeSelect } from "@/components/features/admin/case-assignee-select"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface CaseInboxCommandBarProps {
  item: CaseInboxItem
  staff: StaffAssigneeRow[]
  currentStaffId: string | null
  pending: boolean
  onTake: () => void
  onAssigned: (id: string | null) => void
  onStatus: (status: SupportCaseStatus) => void
  onPriority: (priority: CaseInboxPriority) => void
}

const WORKFLOW_STATUS_VALUES: SupportCaseStatus[] = [
  "in_progress",
  "resolved",
]

export function CaseInboxCommandBar({
  item,
  staff,
  currentStaffId,
  pending,
  onTake,
  onAssigned,
  onStatus,
  onPriority,
}: CaseInboxCommandBarProps) {
  const assignedToMe =
    currentStaffId !== null && item.assigneeAdminId === currentStaffId

  return (
    <div
      className="flex shrink-0 items-center gap-3 overflow-x-auto px-5 py-2"
      aria-label="Case workflow"
    >
      <label className="flex shrink-0 items-center gap-1.5 text-[12px] text-muted-foreground">
        Status
        <Select
          value={item.status === "resolved" ? "resolved" : "in_progress"}
          onValueChange={(value) => onStatus(value as SupportCaseStatus)}
          disabled={pending}
        >
          <SelectTrigger className="h-7 w-[132px] border-0 bg-transparent px-1 shadow-none text-xs font-medium text-foreground">
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
      </label>

      <span className="text-border" aria-hidden>
        /
      </span>

      <label className="flex shrink-0 items-center gap-1.5 text-[12px] text-muted-foreground">
        Priority
        <Select value={item.priority} onValueChange={(value) => onPriority(value as CaseInboxPriority)} disabled={pending}>
          <SelectTrigger className="h-7 w-[88px] border-0 bg-transparent px-1 shadow-none text-xs font-medium capitalize text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </label>

      <span className="text-border" aria-hidden>
        /
      </span>

      <label className="flex shrink-0 items-center gap-1.5 text-[12px] text-muted-foreground">
        Assignee
        <CaseAssigneeSelect
          compact
          backend="support_case"
          caseId={item.id}
          assigneeAdminId={item.assigneeAdminId}
          staff={staff}
          currentUserId={currentStaffId}
          onAssigned={onAssigned}
        />
      </label>

      {currentStaffId && !assignedToMe ? (
        <Button type="button" size="sm" variant="outline" className="ml-auto h-7 shrink-0" disabled={pending} onClick={onTake}>
          <UserCheck className="mr-1 h-3.5 w-3.5" aria-hidden />
          Take over
        </Button>
      ) : null}
    </div>
  )
}
