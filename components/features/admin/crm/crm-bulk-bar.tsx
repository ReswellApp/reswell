"use client"

import { CalendarCheck, ChevronDown, Loader2, Trash2, X } from "lucide-react"
import type { CrmContactPriority, CrmContactStatus } from "@/lib/db/crm"
import { CRM_PRIORITY_LABEL, CRM_STATUS_LABEL } from "@/components/features/admin/crm/crm-labels"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function CrmBulkBar({
  count,
  isPending,
  onClear,
  onSetStatus,
  onSetPriority,
  onMarkContacted,
  onDelete,
}: {
  count: number
  isPending: boolean
  onClear: () => void
  onSetStatus: (status: CrmContactStatus) => void
  onSetPriority: (priority: CrmContactPriority) => void
  onMarkContacted: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-teal-200 bg-teal-50/60 px-3 py-2 dark:border-teal-900 dark:bg-teal-950/30">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClear} aria-label="Clear selection">
          <X className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium tabular-nums">
          {count} selected
        </span>
      </div>
      {isPending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isPending}>
              Set status
              <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Move to stage</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(CRM_STATUS_LABEL) as CrmContactStatus[]).map((status) => (
              <DropdownMenuItem key={status} onSelect={() => onSetStatus(status)}>
                {CRM_STATUS_LABEL[status]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isPending}>
              Set priority
              <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Priority</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(CRM_PRIORITY_LABEL) as CrmContactPriority[]).map((priority) => (
              <DropdownMenuItem key={priority} onSelect={() => onSetPriority(priority)}>
                {CRM_PRIORITY_LABEL[priority]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" size="sm" onClick={onMarkContacted} disabled={isPending}>
          <CalendarCheck className="mr-1.5 h-4 w-4" />
          Mark contacted
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onDelete}
          disabled={isPending}
          className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="mr-1.5 h-4 w-4" />
          Delete
        </Button>
      </div>
    </div>
  )
}
