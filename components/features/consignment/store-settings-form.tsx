"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

interface StoreSettingsFormProps {
  storeId: string
  defaultCommissionBps: number
  status: "active" | "paused"
  stripeTerminalLocationId: string | null
  reswellFeeBps: number
}

export function StoreSettingsForm({
  storeId,
  defaultCommissionBps,
  status: initialStatus,
  stripeTerminalLocationId,
  reswellFeeBps,
}: StoreSettingsFormProps) {
  const router = useRouter()
  const [commissionPct, setCommissionPct] = useState((defaultCommissionBps / 100).toString())
  const [status, setStatus] = useState<"active" | "paused">(initialStatus)
  const [terminalLocation, setTerminalLocation] = useState(stripeTerminalLocationId ?? "")
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const minPct = reswellFeeBps / 100

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)

    const pct = Number.parseFloat(commissionPct)
    if (!Number.isFinite(pct)) {
      setError("Enter a valid commission percentage.")
      return
    }
    const bps = Math.round(pct * 100)

    try {
      const res = await fetch("/api/consignment/store/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          defaultCommissionBps: bps,
          status,
          stripeTerminalLocationId: terminalLocation.trim() || undefined,
        }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(data?.error ?? "Could not save settings")
      setSaved(true)
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings")
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="rounded-lg border p-4">
        <label className="text-sm font-medium" htmlFor="commission">
          Default commission
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          Your cut of each sale. Reswell&apos;s {minPct}% fee comes out of this, so it can&apos;t go
          below {minPct}%.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <input
            id="commission"
            type="number"
            min={minPct}
            max={90}
            step={0.5}
            value={commissionPct}
            onChange={(e) => setCommissionPct(e.target.value)}
            className="h-10 w-28 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <p className="text-sm font-medium">Store status</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Paused stores are hidden and stop accepting new intakes. Existing listings and sales are
          unaffected.
        </p>
        <div className="mt-3 flex gap-2">
          {(["active", "paused"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={
                status === s
                  ? "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground capitalize"
                  : "rounded-md border px-3 py-1.5 text-sm font-medium capitalize"
              }
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <label className="text-sm font-medium" htmlFor="terminal">
          Stripe Terminal location
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          The Terminal location ID (<code>tml_…</code>) whose card readers ring up your in-store
          sales. Leave blank if you don&apos;t use in-person card readers.
        </p>
        <input
          id="terminal"
          type="text"
          value={terminalLocation}
          onChange={(e) => setTerminalLocation(e.target.value)}
          placeholder="tml_..."
          className="mt-3 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save settings"}
        </button>
        {saved ? <span className="text-sm text-muted-foreground">Saved.</span> : null}
        {error ? <span className="text-sm text-destructive">{error}</span> : null}
      </div>
    </form>
  )
}
