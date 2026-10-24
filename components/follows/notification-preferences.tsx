"use client"

import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import type { NotificationPreferences } from "@/lib/follows/types"
import { saveNotificationPreferences } from "@/app/actions/follows"

interface NotificationPreferencesFormProps {
  initial: NotificationPreferences
}

export function NotificationPreferencesForm({ initial }: NotificationPreferencesFormProps) {
  const [prefs, setPrefs] = useState<NotificationPreferences>(initial)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await saveNotificationPreferences(prefs)
      if ("error" in res && res.error) throw new Error()
      setSavedFlash(true)
      window.setTimeout(() => setSavedFlash(false), 2000)
    } catch {
      toast.error("Failed to save preferences")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">
          Follow notifications
        </h3>

        {/* In-app toggle */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="follow-inapp" className="font-medium text-sm">
              In-app notifications
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Up to two a day in the bell when shops you follow post a listing.
            </p>
          </div>
          <Switch
            id="follow-inapp"
            checked={prefs.follow_in_app}
            onCheckedChange={(v) => setPrefs((p) => ({ ...p, follow_in_app: v }))}
          />
        </div>

        {/* Email toggle */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="follow-email" className="font-medium text-sm">
              Email when a shop posts
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Up to two emails a day when shops you follow post a listing.
            </p>
          </div>
          <Switch
            id="follow-email"
            checked={prefs.follow_email_digest}
            onCheckedChange={(v) => setPrefs((p) => ({ ...p, follow_email_digest: v }))}
          />
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving || savedFlash} size="sm">
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : savedFlash ? (
          "Saved"
        ) : (
          "Save preferences"
        )}
      </Button>
    </div>
  )
}
