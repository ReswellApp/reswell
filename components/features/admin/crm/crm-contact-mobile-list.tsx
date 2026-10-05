"use client"

import { format, formatDistanceToNow } from "date-fns"
import {
  crmContactDisplayName,
  type CrmContactWithProfile,
} from "@/lib/db/crm"
import {
  CRM_PRIORITY_LABEL,
  CRM_SOURCE_LABEL,
  CRM_STATUS_LABEL,
  contactNeedsFollowUp,
  crmPriorityBadgeClass,
  crmStatusBadgeClass,
} from "@/components/features/admin/crm/crm-labels"
import { CrmTagChips } from "@/components/features/admin/crm/crm-tag-editor"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
}

interface CrmContactMobileListProps {
  contacts: CrmContactWithProfile[]
  selectedIds: Set<string>
  onOpen: (id: string) => void
  onToggleSelect: (id: string) => void
}

export function CrmContactMobileList({
  contacts,
  selectedIds,
  onOpen,
  onToggleSelect,
}: CrmContactMobileListProps) {
  return (
    <ul className="space-y-2 md:hidden" role="list">
      {contacts.map((contact) => {
        const name = crmContactDisplayName(contact)
        const avatarUrl = contact.profile?.avatar_url
        const needsFollowUp = contactNeedsFollowUp(contact)
        const isSelected = selectedIds.has(contact.id)

        return (
          <li key={contact.id}>
            <div
              className={cn(
                "flex gap-3 rounded-lg border bg-card p-3",
                isSelected && "border-teal-300 bg-teal-50/50 dark:border-teal-900 dark:bg-teal-950/20",
              )}
            >
              <div className="pt-1" onClick={(event) => event.stopPropagation()}>
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleSelect(contact.id)}
                  aria-label={`Select ${name}`}
                />
              </div>
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => onOpen(contact.id)}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
                    <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-medium">{name}</p>
                      {needsFollowUp ? (
                        <Badge
                          variant="outline"
                          className="shrink-0 border-amber-300 text-amber-700"
                        >
                          Due
                        </Badge>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {contact.email ?? contact.profile?.email ?? "No email"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary">{CRM_SOURCE_LABEL[contact.source]}</Badge>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                          crmStatusBadgeClass(contact.status),
                        )}
                      >
                        {CRM_STATUS_LABEL[contact.status]}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                          crmPriorityBadgeClass(contact.priority),
                        )}
                      >
                        {CRM_PRIORITY_LABEL[contact.priority]}
                      </span>
                    </div>
                    {contact.tags.length > 0 ? (
                      <CrmTagChips tags={contact.tags} max={3} className="mt-2" />
                    ) : null}
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {contact.last_contacted_at
                        ? `Contacted ${formatDistanceToNow(new Date(contact.last_contacted_at), { addSuffix: true })}`
                        : "Never contacted"}
                      {contact.next_follow_up_at
                        ? ` · Next ${format(new Date(contact.next_follow_up_at), "MMM d")}`
                        : ""}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
