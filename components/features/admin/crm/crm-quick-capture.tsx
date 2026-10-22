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
      toast.error(!profile ? "Paste a Facebook profile link" : "Paste the Marketplace thread")
      return
    }
    setSaving(true)
    try {
      const result = await createCrmFacebookLeadAction({ profileLink, threadId: threadInput })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(
        result.created
          ? `${result.displayName} saved. Back in ${CRM_FACEBOOK_FOLLOW_UP_DAYS} days.`
          : `${result.displayName} updated.`,
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
        thread ? `Thread ${thread.threadId}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null

  const hint = profileInvalid
    ? "Paste a facebook.com profile link or a numeric profile id."
    : threadInvalid
      ? "Paste the messages thread link or the numeric thread id."
      : preview

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-1.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          ref={profileRef}
          id="crm-fb-profile"
          value={profileLink}
          onChange={(event) => setProfileLink(event.target.value)}
          placeholder="Paste Facebook profile link"
          aria-label="Facebook profile link"
          autoComplete="off"
          spellCheck={false}
          autoFocus
          className="h-11 bg-card"
          onKeyDown={(event) => {
            if (event.key === "Enter" && profile && !thread) {
              event.preventDefault()
              threadRef.current?.focus()
            }
          }}
        />
        <Input
          ref={threadRef}
          id="crm-fb-thread"
          value={threadInput}
          onChange={(event) => setThreadInput(event.target.value)}
          placeholder="Thread link or id"
          aria-label="Marketplace thread"
          autoComplete="off"
          spellCheck={false}
          className="h-11 bg-card sm:max-w-xs"
        />
        <Button type="submit" className="h-11 shrink-0" disabled={saving || !profile || !thread}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </form>
  )
}
