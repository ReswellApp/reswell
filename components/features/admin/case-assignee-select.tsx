"use client"

import { useTransition } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { assignSupportCaseAction } from "@/lib/actions/supportCaseAssign"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { StaffAssigneeRow } from "@/lib/db/searchInsightActions"

const UNASSIGNED = "unassigned"

type CaseAssigneeSelectProps = {
  backend: "contact_message" | "order_support" | "support_case"
  caseId: string
  assigneeAdminId: string | null
  staff: StaffAssigneeRow[]
  currentUserId: string | null
  onAssigned: (assigneeAdminId: string | null) => void
}

export function CaseAssigneeSelect({
  backend,
  caseId,
  assigneeAdminId,
  staff,
  currentUserId,
  onAssigned,
}: CaseAssigneeSelectProps) {
  const [pending, startTransition] = useTransition()

  function assign(next: string) {
    const assignee_admin_id = next === UNASSIGNED ? null : next
    startTransition(async () => {
      const res = await assignSupportCaseAction({
        backend,
        id: caseId,
        assignee_admin_id,
      })
      if ("error" in res && res.error) {
        toast.error(res.error)
        return
      }
      onAssigned(assignee_admin_id)
      toast.success(assignee_admin_id ? "Assigned" : "Unassigned")
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Assignee
        </Label>
        {currentUserId && assigneeAdminId !== currentUserId ? (
          <button
            type="button"
            className="text-[11px] font-medium text-foreground underline-offset-2 hover:underline disabled:opacity-50"
            disabled={pending}
            onClick={() => assign(currentUserId)}
          >
            Assign me
          </button>
        ) : null}
      </div>
      <Select
        value={assigneeAdminId ?? UNASSIGNED}
        onValueChange={assign}
        disabled={pending}
      >
        <SelectTrigger className="h-9 bg-background">
          <SelectValue placeholder="Unassigned" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
          {staff.map((person) => (
            <SelectItem key={person.id} value={person.id}>
              {(person.display_name ?? "Staff").trim() || "Staff"}
              {person.id === currentUserId ? " (you)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {pending ? (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Saving…
        </p>
      ) : null}
    </div>
  )
}
