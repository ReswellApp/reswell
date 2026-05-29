"use client"

import { RotateCcw } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { counterTone } from "./seo-scoring"

interface FieldCounterProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  /** Shown as placeholder + in the "uses default" hint. */
  placeholder?: string
  helpText?: string
  multiline?: boolean
  rows?: number
  band?: { min: number; max: number; hardMax: number }
  /** When true, shows a reset-to-default control. */
  overridden?: boolean
  onReset?: () => void
  onFocus?: () => void
  mono?: boolean
}

const TONE_CLASS: Record<string, string> = {
  good: "text-emerald-600",
  warn: "text-amber-600",
  over: "text-destructive",
}

export function FieldCounter({
  id,
  label,
  value,
  onChange,
  placeholder,
  helpText,
  multiline,
  rows = 3,
  band,
  overridden,
  onReset,
  onFocus,
  mono,
}: FieldCounterProps) {
  const length = value.length
  const tone = band ? counterTone(length, band) : "good"

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-xs font-medium text-foreground">
          {label}
        </Label>
        <div className="flex items-center gap-2">
          {band ? (
            <span className={cn("text-[11px] tabular-nums", TONE_CLASS[tone])}>
              {length}
              <span className="text-muted-foreground">/{band.max}</span>
            </span>
          ) : null}
          {overridden && onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              Reset
            </button>
          ) : null}
        </div>
      </div>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          rows={rows}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          className={cn(mono && "font-mono text-xs")}
        />
      ) : (
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          className={cn(mono && "font-mono text-xs")}
        />
      )}
      {helpText ? <p className="text-[11px] text-muted-foreground">{helpText}</p> : null}
      {!value && placeholder ? (
        <p className="truncate text-[11px] text-muted-foreground">
          Default: <span className="text-foreground/70">{placeholder}</span>
        </p>
      ) : null}
    </div>
  )
}
