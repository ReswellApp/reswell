"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

interface IntakeGateToggleProps {
  storeId: string
  requireIntakeToken: boolean
  className?: string
}

export function IntakeGateToggle({
  storeId,
  requireIntakeToken,
  className,
}: IntakeGateToggleProps) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(requireIntakeToken)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function toggle(next: boolean) {
    setError(null)
    const previous = enabled
    setEnabled(next)
    try {
      const res = await fetch("/api/consignment/store/intake-gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, requireIntakeToken: next }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? "Could not update intake settings")
      }
      startTransition(() => router.refresh())
    } catch (err) {
      setEnabled(previous)
      setError(err instanceof Error ? err.message : "Could not update intake settings")
    }
  }

  return (
    <div className={cn("rounded-lg border p-4 text-left", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Require this QR to consign</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {enabled
              ? "Only people who scan this QR (or open this exact link) can consign here."
              : "Anyone with a Reswell account can consign to your store from the link below."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={isPending}
          onClick={() => toggle(!enabled)}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
            enabled ? "bg-primary" : "bg-muted-foreground/30",
          )}
        >
          <span
            className={cn(
              "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
              enabled ? "translate-x-5" : "translate-x-0.5",
            )}
          />
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  )
}
