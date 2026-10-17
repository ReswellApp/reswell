"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { markCrmContactedAction } from "@/lib/actions/crmAdmin"
import { crmContactDisplayName, type CrmContactWithProfile } from "@/lib/db/crm"
import { addDaysIso, CRM_FACEBOOK_SNOOZE_DAYS } from "@/lib/utils/facebookLead"
import { CrmFacebookLinks } from "@/components/features/admin/crm/crm-facebook-links"
import { CrmFollowUpRun } from "@/components/features/admin/crm/crm-follow-up-run"
import { Button } from "@/components/ui/button"

interface CrmFollowUpQueueProps {
  contacts: CrmContactWithProfile[]
  onOpen: (id: string) => void
  onMutated: () => void
}

export function CrmFollowUpQueue({ contacts, onOpen, onMutated }: CrmFollowUpQueueProps) {
  const [expanded, setExpanded] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const visible = expanded ? contacts : contacts.slice(0, 4)

  async function markFollowedUp(contactId: string) {
    setBusyId(contactId)
    try {
      const result = await markCrmContactedAction({
        contactId,
        nextFollowUpAt: addDaysIso(CRM_FACEBOOK_SNOOZE_DAYS),
      })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(`Logged. Back in ${CRM_FACEBOOK_SNOOZE_DAYS} days.`)
      onMutated()
    } catch (err) {
      console.error("CrmFollowUpQueue.markFollowedUp:", err)
      toast.error("Could not update that follow-up")
    } finally {
      setBusyId(null)
    }
  }

  if (contacts.length === 0) return null

  return (
    <section className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{contacts.length} to reach back out</span>
          <span> · no listing or purchase yet</span>
        </p>
        <CrmFollowUpRun contacts={contacts} onMutated={onMutated} />
      </div>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {visible.map((contact) => {
          const name = crmContactDisplayName(contact)
          const when = contact.last_contacted_at
            ? formatDistanceToNow(new Date(contact.last_contacted_at), { addSuffix: true })
            : "Never contacted"
          return (
            <li key={contact.id} className="flex items-center gap-3 px-3 py-2">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(contact.id)}>
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="text-xs text-muted-foreground">{when}</p>
              </button>
              <CrmFacebookLinks
                profileUrl={contact.facebook_profile_url}
                threadUrl={contact.facebook_thread_url}
                compact
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="shrink-0"
                title="Reached out. Remind me in 7 days."
                disabled={busyId === contact.id}
                onClick={() => void markFollowedUp(contact.id)}
              >
                {busyId === contact.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Done
              </Button>
            </li>
          )
        })}
      </ul>
      {contacts.length > 4 ? (
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Show fewer" : `Show all ${contacts.length}`}
        </Button>
      ) : null}
    </section>
  )
}
