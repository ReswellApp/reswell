"use client"

import { useEffect, useRef, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { logCrmInteractionAction, markCrmContactedAction } from "@/lib/actions/crmAdmin"
import { crmContactDisplayName, type CrmContactWithProfile } from "@/lib/db/crm"
import { addDaysIso, CRM_FACEBOOK_SNOOZE_DAYS } from "@/lib/utils/facebookLead"
import {
  CRM_FOLLOW_UP_TEMPLATE_DEFAULT,
  followUpGreetingName,
  renderFollowUpMessage,
} from "@/lib/utils/crmFollowUp"
import { safeFacebookHref } from "@/components/features/admin/crm/crm-facebook-links"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

const TEMPLATE_KEY = "crm:follow-up-message"

interface CrmFollowUpRunProps {
  contacts: CrmContactWithProfile[]
  onMutated: () => void
}

export function CrmFollowUpRun({ contacts, onMutated }: CrmFollowUpRunProps) {
  const [open, setOpen] = useState(false)
  const [batch, setBatch] = useState<CrmContactWithProfile[]>([])
  const [index, setIndex] = useState(0)
  const [sentCount, setSentCount] = useState(0)
  const [skipCount, setSkipCount] = useState(0)
  const [template, setTemplate] = useState(CRM_FOLLOW_UP_TEMPLATE_DEFAULT)
  const [editingTemplate, setEditingTemplate] = useState(false)
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const dialogOpenRef = useRef(false)

  useEffect(() => {
    const saved = window.localStorage.getItem(TEMPLATE_KEY)
    if (saved?.trim()) setTemplate(saved)
  }, [])

  const contact = batch[index] ?? null
  const finished = open && batch.length > 0 && index >= batch.length

  useEffect(() => {
    if (!contact) return
    setDraft(renderFollowUpMessage(template, followUpGreetingName(crmContactDisplayName(contact))))
  }, [contact, template])

  function rememberTemplate(next: string) {
    setTemplate(next)
    window.localStorage.setItem(TEMPLATE_KEY, next)
  }

  function openChat(person: CrmContactWithProfile, message: string) {
    const href = safeFacebookHref(person.facebook_thread_url)
    if (href) window.open(href, "_blank", "noopener,noreferrer")
    void navigator.clipboard.writeText(message).catch(() => {
      toast.error("Could not copy the message. Select it and copy it yourself.")
    })
  }

  function begin() {
    if (contacts.length === 0) return
    const first = contacts[0]
    if (!first) return
    const message = renderFollowUpMessage(template, followUpGreetingName(crmContactDisplayName(first)))
    setBatch(contacts)
    setIndex(0)
    setSentCount(0)
    setSkipCount(0)
    setDraft(message)
    dialogOpenRef.current = true
    setOpen(true)
    openChat(first, message)
  }

  function advance(nextIndex: number) {
    const next = batch[nextIndex]
    if (next) {
      const message = renderFollowUpMessage(template, followUpGreetingName(crmContactDisplayName(next)))
      setDraft(message)
      openChat(next, message)
    }
    setIndex(nextIndex)
  }

  async function sentAndNext() {
    if (!contact || busy) return
    const notes = draft.trim()
    if (!notes) {
      toast.error("Write a message before logging it")
      return
    }
    setBusy(true)
    try {
      const logged = await logCrmInteractionAction({
        contactId: contact.id,
        interactionType: "other",
        subject: "Marketplace follow-up",
        notes,
      })
      if ("error" in logged) {
        toast.error(logged.error)
        return
      }
      const marked = await markCrmContactedAction({
        contactId: contact.id,
        nextFollowUpAt: addDaysIso(CRM_FACEBOOK_SNOOZE_DAYS),
      })
      if ("error" in marked) {
        toast.error(marked.error)
        return
      }
      setSentCount((count) => count + 1)
      if (dialogOpenRef.current) {
        advance(index + 1)
      } else {
        onMutated()
      }
    } catch (err) {
      console.error("CrmFollowUpRun.sentAndNext:", err)
      toast.error("Could not log that follow-up")
    } finally {
      setBusy(false)
    }
  }

  function close(nextOpen: boolean) {
    dialogOpenRef.current = nextOpen
    setOpen(nextOpen)
    if (!nextOpen && (sentCount > 0 || index > 0)) onMutated()
  }

  const name = contact ? crmContactDisplayName(contact) : ""
  const when = contact?.last_contacted_at
    ? `Last contact ${formatDistanceToNow(new Date(contact.last_contacted_at), { addSuffix: true })}`
    : "Never contacted"

  return (
    <>
      <Button type="button" size="sm" onClick={begin} disabled={contacts.length === 0}>
        Start
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-w-lg">
          {finished ? (
            <>
              <DialogHeader>
                <DialogTitle>Follow-ups done</DialogTitle>
                <DialogDescription>
                  Logged {sentCount}. Skipped {skipCount}.
                </DialogDescription>
              </DialogHeader>
              <Button type="button" onClick={() => close(false)}>
                Close
              </Button>
            </>
          ) : contact ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {index + 1} of {batch.length}
                </DialogTitle>
                <DialogDescription>
                  The message is copied and the chat is open. Send it on Facebook, then come back here.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <p className="font-medium">{name}</p>
                  <p className="text-xs text-muted-foreground">{when}</p>
                </div>
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={5}
                  aria-label="Message to send"
                />
                {editingTemplate ? (
                  <Textarea
                    value={template}
                    onChange={(event) => rememberTemplate(event.target.value)}
                    rows={3}
                    aria-label="Message template"
                  />
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => openChat(contact, draft)}>
                      Open chat
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingTemplate((value) => !value)}
                    >
                      {editingTemplate ? "Hide template" : "Edit template"}
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        setSkipCount((count) => count + 1)
                        advance(index + 1)
                      }}
                    >
                      Skip
                    </Button>
                    <Button type="button" size="sm" disabled={busy} onClick={() => void sentAndNext()}>
                      {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                      Sent, next
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Use {"{name}"} in the template for their first name.</p>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
