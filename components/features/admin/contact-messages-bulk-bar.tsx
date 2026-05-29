"use client"

import { ChevronDown, Download, Loader2, X } from "lucide-react"
import type { ContactMessageSupportStatus } from "@/lib/db/contactMessages"
import {
  STATUS_LABEL,
  STATUS_LIST,
} from "@/components/features/admin/contact-messages-labels"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ContactMessagesBulkBar({
  count,
  isPending,
  onClear,
  onSetStatus,
  onExport,
}: {
  count: number
  isPending: boolean
  onClear: () => void
  onSetStatus: (status: ContactMessageSupportStatus) => void
  onExport: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-teal-200 bg-teal-50/60 px-3 py-2 dark:border-teal-900 dark:bg-teal-950/30">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClear} aria-label="Clear selection">
          <X className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium tabular-nums">{count} selected</span>
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
            {STATUS_LIST.map((status) => (
              <DropdownMenuItem key={status} onSelect={() => onSetStatus(status)}>
                {STATUS_LABEL[status]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" size="sm" onClick={onExport} disabled={isPending}>
          <Download className="mr-1.5 h-4 w-4" />
          Export
        </Button>
      </div>
    </div>
  )
}
