"use client"

import { cn } from "@/lib/utils"

export function PnlMoneyInput({
  value,
  onChange,
  placeholder = "0",
  missing,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  missing?: boolean
  ariaLabel: string
}) {
  return (
    <div
      className={cn(
        "flex h-9 w-full min-w-0 items-center rounded-md border bg-background",
        missing ? "border-amber-300 bg-amber-50" : "border-border",
      )}
    >
      <span className="w-5 shrink-0 text-center text-xs text-muted-foreground">$</span>
      <input
        aria-label={ariaLabel}
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-full min-w-0 flex-1 bg-transparent pr-2 text-right text-sm tabular-nums outline-none placeholder:text-muted-foreground/70"
      />
    </div>
  )
}

export function PnlDateInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
}) {
  return (
    <input
      aria-label={ariaLabel}
      type="date"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring"
    />
  )
}

export function PnlTextInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel: string
}) {
  return (
    <input
      aria-label={ariaLabel}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs outline-none placeholder:text-muted-foreground/70 focus:border-ring focus:ring-1 focus:ring-ring"
    />
  )
}
