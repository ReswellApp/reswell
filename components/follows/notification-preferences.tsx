"use client"

import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import type { NotificationPreferences } from "@/lib/follows/types"

interface NotificationPreferencesFormProps {
  initial: NotificationPreferences
}

export function NotificationPreferencesForm({ initial }: NotificationPreferencesFormProps) {
  const [prefs, setPrefs] = useState<NotificationPreferences>(initial)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/follows/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      })
      if (!res.ok) throw new Error()
      toast.success("Preferences saved")
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
              Show a bell badge when followed sellers post new listings
            </p>
          </div>
          <Switch
            id="follow-inapp"
            checked={prefs.follow_in_app}
            onCheckedChange={(v) => setPrefs((p) => ({ ...p, follow_in_app: v }))}
          />
        </div>

        {/* Email digest toggle */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="follow-email" className="font-medium text-sm">
              Daily email digest
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              One email per day (max) summarising new listings from sellers you follow
            </p>
          </div>
          <Switch
            id="follow-email"
            checked={prefs.follow_email_digest}
            onCheckedChange={(v) => setPrefs((p) => ({ ...p, follow_email_digest: v }))}
          />
        </div>

        {/* Digest time (only shown when email digest is on) */}
        {prefs.follow_email_digest && (
          <div className="pl-0 pt-1">
            <Label className="text-sm font-medium mb-2 block">Email digest timing</Label>
            <RadioGroup
              value={prefs.digest_time}
              onValueChange={(v) =>
                setPrefs((p) => ({ ...p, digest_time: v as "morning" | "evening" }))
              }
              className="flex gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="morning" id="digest-morning" />
                <Label htmlFor="digest-morning" className="font-normal cursor-pointer">
                  Morning (9am)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="evening" id="digest-evening" />
                <Label htmlFor="digest-evening" className="font-normal cursor-pointer">
                  Evening (6pm)
                </Label>
              </div>
            </RadioGroup>
          </div>
        )}
      </div>

      <Button onClick={handleSave} disabled={saving} size="sm">
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : (
          "Save preferences"
        )}
      </Button>
    </div>
  )
}
