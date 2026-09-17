"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { LiveChatPendingShippingAction } from "@/lib/services/liveChatShippingActions"

interface LiveChatPendingActionsProps {
  publicId: string | null
  visitorToken: string | null
  enabled: boolean
  isSignedIn: boolean
  onAuthRequired?: () => void
}

export function LiveChatPendingActions({
  publicId,
  visitorToken,
  enabled,
  isSignedIn,
  onAuthRequired,
}: LiveChatPendingActionsProps) {
  const [actions, setActions] = useState<LiveChatPendingShippingAction[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!publicId || !enabled) return
    const qs = visitorToken
      ? `?visitor_token=${encodeURIComponent(visitorToken)}`
      : ""
    try {
      const res = await fetch(
        `/api/live-chat/session/${encodeURIComponent(publicId)}/actions${qs}`,
      )
      const json = (await res.json()) as {
        data?: { actions: LiveChatPendingShippingAction[] }
      }
      if (res.ok && json.data) setActions(json.data.actions)
    } catch {
      /* best-effort */
    }
  }, [enabled, publicId, visitorToken])

  useEffect(() => {
    void refresh()
    if (!enabled || !publicId) return
    const timer = window.setInterval(() => void refresh(), 4000)
    return () => window.clearInterval(timer)
  }, [enabled, publicId, refresh])

  async function decide(actionId: string, decision: "confirm" | "cancel") {
    if (!publicId) return
    if (decision === "confirm" && !isSignedIn) {
      onAuthRequired?.()
      setError("Sign in to confirm shipping changes for your account.")
      return
    }
    setBusyId(actionId)
    setError(null)
    try {
      const res = await fetch(`/api/live-chat/session/${encodeURIComponent(publicId)}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_id: actionId,
          decision,
          visitor_token: visitorToken || undefined,
        }),
      })
      const json = (await res.json()) as {
        data?: { actions: LiveChatPendingShippingAction[]; message?: string }
        error?: string
        code?: string
      }
      if (!res.ok) {
        if (json.code === "auth_required") onAuthRequired?.()
        setError(json.error ?? "Could not update that action.")
        return
      }
      setActions(json.data?.actions ?? [])
    } catch {
      setError("Could not update that action.")
    } finally {
      setBusyId(null)
    }
  }

  if (!enabled || actions.length === 0) return null

  return (
    <div className="space-y-2 border-t border-border/40 bg-muted/30 px-3 py-2">
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {actions.map((action) => (
        <div
          key={action.id}
          className="rounded-xl border border-border/60 bg-background px-3 py-2.5 shadow-sm"
        >
          <p className="text-xs font-semibold text-foreground">{action.summary}</p>
          {action.note ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{action.note}</p>
          ) : null}
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              size="sm"
              className="h-7 rounded-full px-3 text-xs"
              disabled={busyId === action.id}
              onClick={() => void decide(action.id, "confirm")}
            >
              {busyId === action.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                "Confirm"
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 rounded-full px-3 text-xs"
              disabled={busyId === action.id}
              onClick={() => void decide(action.id, "cancel")}
            >
              Cancel
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
