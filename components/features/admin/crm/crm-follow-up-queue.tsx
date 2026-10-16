"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { markCrmContactedAction } from "@/lib/actions/crmAdmin"
import { crmContactDisplayName, type CrmContactWithProfile } from "@/lib/db/crm"
import { addDaysIso, CRM_FACEBOOK_SNOOZE_DAYS } from "@/lib/utils/facebookLead"
import { CrmFacebookLinks } from "@/components/features/admin/crm/crm-facebook-links"
import { Button } from "@/components/ui/button"

interface CrmFollowUpQueueProps {
  contacts: CrmContactWithProfile[]
  onOpen: (id: string) => void
  onMutated: () => void
}

export function CrmFollowUpQueue({ contacts, onOpen, onMutated }: CrmFollowUpQueueProps) {
  const [expanded, setExpanded] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const visible = expanded ? contacts : contacts.slice(0, 6)

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
      toast.success(`Logged. We'll remind you in ${CRM_FACEBOOK_SNOOZE_DAYS} days.`)
      onMutated()
    } catch (err) {
      console.error("CrmFollowUpQueue.markFollowedUp:", err)
      toast.error("Could not update that follow-up")
    } finally {
      setBusyId(null)
    }
  }

  if (contacts.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
        No follow-ups due. Leads you save come back here in 3 days if they still haven&apos;t listed a board or bought.
      </p>
    )
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-100 px-2 text-xs font-semibold text-amber-900">
            {contacts.length}
          </span>
          <div>
            <h2 className="text-sm font-semibold">Time to reach back out</h2>
            <p className="text-xs text-muted-foreground">No surfboard listed and no purchase yet.</p>
          </div>
        </div>
      </div>
      <ul>
        {visible.map((contact) => {
          const name = crmContactDisplayName(contact)
          const when = contact.last_contacted_at
            ? `Last contact ${formatDistanceToNow(new Date(contact.last_contacted_at), { addSuffix: true })}`
            : "Never contacted"
          return (
            <li key={contact.id} className="flex flex-col gap-3 border-b px-4 py-3 last:border-b-0 sm:flex-row sm:items-center">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(contact.id)}>
                <p className="truncate font-medium">{name}</p>
                <p className="text-xs text-muted-foreground">{when}</p>
              </button>
              <div className="flex flex-wrap items-center gap-1.5">
                <CrmFacebookLinks profileUrl={contact.facebook_profile_url} threadUrl={contact.facebook_thread_url} />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busyId === contact.id}
                  onClick={() => void markFollowedUp(contact.id)}
                >
                  {busyId === contact.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  Followed up
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
      {contacts.length > 6 ? (
        <div className="border-t px-4 py-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded((value) => !value)}>
            {expanded ? "Show fewer" : `Show all ${contacts.length}`}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
