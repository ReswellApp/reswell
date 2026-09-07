"use client"

import { useState } from "react"
import { Loader2, Mail } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

type RunResult = {
  eligible?: number
  emitted?: number
  qualifiedInstead?: number
  skippedNoEmail?: number
  failed?: number
  error?: string
}

export function GiveawayListingRemindersButton({ unlistedCount }: { unlistedCount: number }) {
  const [running, setRunning] = useState(false)

  async function sendReminders() {
    setRunning(true)
    try {
      const res = await fetch("/api/admin/giveaways/listing-reminders/run", {
        method: "POST",
        credentials: "include",
      })
      const data = (await res.json().catch(() => ({}))) as RunResult
      if (!res.ok) {
        toast.error(data.error || "Could not send listing reminders")
        return
      }
      toast.success(
        `Reminders sent: ${data.emitted ?? 0} emailed · ${data.qualifiedInstead ?? 0} already listed · ${data.skippedNoEmail ?? 0} missing email · ${data.failed ?? 0} failed`,
      )
    } catch {
      toast.error("Could not send listing reminders")
    } finally {
      setRunning(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={running || unlistedCount === 0}
      onClick={() => void sendReminders()}
    >
      {running ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Mail className="mr-2 h-4 w-4" />
      )}
      Email {unlistedCount} not listed yet
    </Button>
  )
}
