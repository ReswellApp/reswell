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
      className="grid shrink-0 grid-cols-2 gap-x-2 gap-y-1 px-3 py-2 md:flex md:items-center md:gap-3 md:overflow-x-auto md:px-5"
      aria-label="Case workflow"
    >
      <label className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground">
        Status
        <Select
          value={item.status === "resolved" ? "resolved" : "in_progress"}
          onValueChange={(value) => onStatus(value as SupportCaseStatus)}
          disabled={pending}
        >
          <SelectTrigger className="h-8 min-w-0 flex-1 border-0 bg-transparent px-1 shadow-none text-xs font-medium text-foreground md:h-7 md:w-[132px] md:flex-none">
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

      <span className="hidden text-border md:inline" aria-hidden>
        /
      </span>

      <label className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground">
        Priority
        <Select value={item.priority} onValueChange={(value) => onPriority(value as CaseInboxPriority)} disabled={pending}>
          <SelectTrigger className="h-8 min-w-0 flex-1 border-0 bg-transparent px-1 shadow-none text-xs font-medium capitalize text-foreground md:h-7 md:w-[88px] md:flex-none">
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

      <span className="hidden text-border md:inline" aria-hidden>
        /
      </span>

      <label className="col-span-2 flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground md:col-auto">
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
        <Button type="button" size="sm" variant="outline" className="col-span-2 h-8 md:ml-auto md:h-7 md:w-auto" disabled={pending} onClick={onTake}>
          <UserCheck className="mr-1 h-3.5 w-3.5" aria-hidden />
          Take over
        </Button>
      ) : null}
    </div>
  )
}
