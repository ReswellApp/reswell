"use client"

import { useRef, useState, type FormEvent } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createCrmFacebookLeadAction } from "@/lib/actions/crmAdmin"
import {
  CRM_FACEBOOK_FOLLOW_UP_DAYS,
  parseFacebookProfileInput,
  parseFacebookThreadInput,
} from "@/lib/utils/facebookLead"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface CrmQuickCaptureProps {
  onSaved: () => void
}

export function CrmQuickCapture({ onSaved }: CrmQuickCaptureProps) {
  const profileRef = useRef<HTMLInputElement>(null)
  const threadRef = useRef<HTMLInputElement>(null)
  const [profileLink, setProfileLink] = useState("")
  const [threadInput, setThreadInput] = useState("")
  const [saving, setSaving] = useState(false)

  const profile = profileLink.trim() ? parseFacebookProfileInput(profileLink) : null
  const thread = threadInput.trim() ? parseFacebookThreadInput(threadInput) : null
  const profileInvalid = profileLink.trim().length > 0 && !profile
  const threadInvalid = threadInput.trim().length > 0 && !thread

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    if (!profile || !thread) {
      toast.error(!profile ? "Paste a Facebook profile link" : "Paste the Marketplace thread or listing link")
      return
    }
    setSaving(true)
    try {
      const result = await createCrmFacebookLeadAction({ profileLink, threadId: threadInput })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      const pulled = result.enriched ? "Name pulled from the profile." : "Saved the link. Add a name whenever you have it."
      toast.success(
        result.created
          ? `${result.displayName} saved. Follow up in ${CRM_FACEBOOK_FOLLOW_UP_DAYS} days. ${pulled}`
          : `${result.displayName} is already here — chat link updated.`,
      )
      setProfileLink("")
      setThreadInput("")
      onSaved()
      profileRef.current?.focus()
    } catch (err) {
      console.error("CrmQuickCapture:", err)
      toast.error("Could not save that lead")
    } finally {
      setSaving(false)
    }
  }

  const preview = profile
    ? [
        profile.displayName,
        profile.username ? `@${profile.username}` : null,
        profile.profileId ? `ID ${profile.profileId}` : null,
        thread?.listingId ? `Listing ${thread.listingId}` : thread ? `Thread ${thread.threadId}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 space-y-1">
        <h2 className="text-base font-semibold tracking-tight">Add a Marketplace lead</h2>
        <p className="text-sm text-muted-foreground">
          Paste the Facebook profile and the message thread or listing. Hit enter, then the next one.
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="crm-fb-profile">Facebook profile link</Label>
          <Input
            ref={profileRef}
            id="crm-fb-profile"
            value={profileLink}
            onChange={(event) => setProfileLink(event.target.value)}
            placeholder="https://facebook.com/…"
            className="min-w-0"
            autoComplete="off"
            spellCheck={false}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter" && profile && !thread) {
                event.preventDefault()
                threadRef.current?.focus()
              }
            }}
          />
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="crm-fb-thread">Marketplace thread or listing</Label>
          <Input
            ref={threadRef}
            id="crm-fb-thread"
            value={threadInput}
            onChange={(event) => setThreadInput(event.target.value)}
            placeholder="Listing link, thread, or id"
            className="min-w-0"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <Button type="submit" className="w-full shrink-0 lg:w-auto" disabled={saving || !profile || !thread}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {saving ? "Saving…" : "Save lead"}
        </Button>
      </div>
      <p className="mt-3 min-h-5 text-xs text-muted-foreground">
        {profileInvalid
          ? "Use a facebook.com profile link, or the numeric profile id."
          : threadInvalid
            ? "Use the messages thread link, the listing link, or the numeric thread id."
            : preview
              ? preview
              : "A public name is filled in when Facebook includes one. First name and notes can wait."}
      </p>
    </form>
  )
}
