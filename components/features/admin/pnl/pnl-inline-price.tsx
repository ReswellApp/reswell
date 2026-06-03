"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/pnl-calc"

interface PnlInlinePriceProps {
  value: number
  /** Persist the new price. Resolve true on success so the editor can close. */
  onSave: (price: number) => Promise<boolean>
  className?: string
}

function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "")
  if (cleaned === "") return 0
  const n = Number(cleaned)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}

export function PnlInlinePrice({ value, onSave, className }: PnlInlinePriceProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  function open() {
    setDraft(value ? String(value) : "")
    setEditing(true)
  }

  async function commit() {
    if (saving) return
    const parsed = parsePrice(draft)
    if (parsed == null) {
      setEditing(false)
      return
    }
    if (parsed === value) {
      setEditing(false)
      return
    }
    setSaving(true)
    const ok = await onSave(parsed)
    setSaving(false)
    if (ok) setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center justify-end gap-1">
        <span className="text-muted-foreground">$</span>
        <input
          ref={inputRef}
          inputMode="decimal"
          value={draft}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") void commit()
            if (e.key === "Escape") setEditing(false)
          }}
          className="h-7 w-20 rounded border border-input bg-background px-1.5 text-right text-sm tabular-nums outline-none focus:ring-1 focus:ring-ring"
        />
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        "inline-flex items-center justify-end gap-1 rounded px-1 py-0.5 tabular-nums hover:bg-muted",
        value ? "" : "text-muted-foreground",
        className,
      )}
      title="Click to edit purchase price"
    >
      {value ? (
        formatCurrency(value)
      ) : (
        <>
          <Plus className="h-3 w-3" />
          Add price
        </>
      )}
    </button>
  )
}
