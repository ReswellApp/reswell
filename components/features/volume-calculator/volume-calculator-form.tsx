"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  normalizeBoardLengthInput,
  normalizeTapeStyleInchesInput,
} from "@/lib/board-measurements"
import { VOLUME_BUCKETS } from "@/lib/boards-browse-facets"
import {
  estimateSurfboardVolumeLiters,
  parseSurfboardVolumeFormInput,
  VOLUME_OUTLINE_FULLNESS_HINTS,
  VOLUME_OUTLINE_FULLNESS_LABELS,
  VOLUME_OUTLINE_FULLNESS_ORDER,
  volumeOutlineOptions,
  type SurfboardVolumeEstimate,
  type VolumeOutlineFullness,
} from "@/lib/services/surfboardVolumeCalculator"
import type { SurfboardSellCategoryKey } from "@/lib/surfboard-sell-categories"
import { cn } from "@/lib/utils"

function volumeBrowseHref(liters: number): { href: string; label: string } {
  const bucket =
    VOLUME_BUCKETS.find(
      (b) => (b.min == null || liters >= b.min) && (b.max == null || liters < b.max),
    ) ?? null
  if (!bucket) {
    return {
      href: `/boards?dimVolume=${encodeURIComponent(String(Math.round(liters)))}`,
      label: `Browse ~${Math.round(liters)} L boards`,
    }
  }
  return {
    href: `/boards?volume=${encodeURIComponent(bucket.value)}`,
    label: `Browse ${bucket.label} boards`,
  }
}

function formatLiters(value: number): string {
  return value.toFixed(1).replace(/\.0$/, ".0")
}

function VolumeEstimateResult({ estimate }: { estimate: SurfboardVolumeEstimate }) {
  const browse = volumeBrowseHref(estimate.litersDisplay)
  return (
    <div
      className="rounded-xl border border-foreground/10 bg-muted/30 px-5 py-5"
      aria-live="polite"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Estimated volume
      </p>
      <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums text-foreground">
        {formatLiters(estimate.litersDisplay)}
        <span className="ml-1 text-lg font-medium text-muted-foreground">L</span>
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Likely range{" "}
        <span className="font-medium text-foreground tabular-nums">
          {formatLiters(estimate.rangeLiters.low)}–{formatLiters(estimate.rangeLiters.high)} L
        </span>{" "}
        · shape factor {estimate.shapeFactor.toFixed(2)}
      </p>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Manufacturer volumes come from 3D CAD of the finished shape. This estimate uses max
        length × width × thickness with an outline shape factor — the same DIY method shapers use
        when a board is unmarked. Expect it within about 5–10% of a stock volume label.
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        Looking for a board around this volume?{" "}
        <Link href={browse.href} className="font-medium text-primary underline underline-offset-4">
          {browse.label}
        </Link>
        .
      </p>
    </div>
  )
}

export function VolumeCalculatorForm() {
  const outlines = useMemo(() => volumeOutlineOptions(), [])
  const [boardLength, setBoardLength] = useState("")
  const [boardWidthInches, setBoardWidthInches] = useState("")
  const [boardThicknessInches, setBoardThicknessInches] = useState("")
  const [outline, setOutline] = useState<SurfboardSellCategoryKey | "">("")
  const [fullness, setFullness] = useState<VolumeOutlineFullness>("standard")
  const [error, setError] = useState<string | null>(null)
  const [estimate, setEstimate] = useState<SurfboardVolumeEstimate | null>(null)

  function calculate() {
    const parsed = parseSurfboardVolumeFormInput({
      boardLength,
      boardWidthInches,
      boardThicknessInches,
      outline,
      fullness,
    })
    if (!parsed.ok) {
      setEstimate(null)
      setError(parsed.error)
      return
    }
    setError(null)
    setEstimate(estimateSurfboardVolumeLiters(parsed.input))
  }

  function reset() {
    setBoardLength("")
    setBoardWidthInches("")
    setBoardThicknessInches("")
    setOutline("")
    setFullness("standard")
    setError(null)
    setEstimate(null)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="vol-calc-length" className="text-sm font-medium">
            Length
          </Label>
          <Input
            id="vol-calc-length"
            inputMode="text"
            placeholder="6'2"
            value={boardLength}
            onChange={(e) => setBoardLength(normalizeBoardLengthInput(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                calculate()
              }
            }}
            className="h-11 tabular-nums"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vol-calc-width" className="text-sm font-medium">
            Width
          </Label>
          <Input
            id="vol-calc-width"
            inputMode="text"
            placeholder={'19 1/4"'}
            value={boardWidthInches}
            onChange={(e) =>
              setBoardWidthInches(normalizeTapeStyleInchesInput(e.target.value))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                calculate()
              }
            }}
            className="h-11 tabular-nums"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vol-calc-thickness" className="text-sm font-medium">
            Thickness
          </Label>
          <Input
            id="vol-calc-thickness"
            inputMode="text"
            placeholder={'2 3/8"'}
            value={boardThicknessInches}
            onChange={(e) =>
              setBoardThicknessInches(normalizeTapeStyleInchesInput(e.target.value))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                calculate()
              }
            }}
            className="h-11 tabular-nums"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Outline</Label>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Pick the board style closest to the plan shape. Fuller outlines carry more volume
          at the same length, width, and thickness.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {outlines.map((opt) => {
            const selected = outline === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setOutline(opt.value)}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  selected
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground/15 bg-card hover:border-foreground/35 hover:bg-muted/40",
                )}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  {selected ? (
                    <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} aria-hidden />
                  ) : null}
                  {opt.label}
                </span>
                <span
                  className={cn(
                    "mt-0.5 block text-[11px] leading-snug",
                    selected ? "text-background/75" : "text-muted-foreground",
                  )}
                >
                  {opt.description}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Outline fullness</Label>
        <div className="flex flex-wrap gap-2">
          {VOLUME_OUTLINE_FULLNESS_ORDER.map((value) => {
            const selected = fullness === value
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => setFullness(value)}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  selected
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground/20 bg-card text-foreground hover:border-foreground/40 hover:bg-muted/50",
                )}
              >
                {VOLUME_OUTLINE_FULLNESS_LABELS[value]}
              </button>
            )
          })}
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">
          {VOLUME_OUTLINE_FULLNESS_HINTS[fullness]}
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" className="h-11 px-6" onClick={calculate}>
          Calculate volume
        </Button>
        <Button type="button" variant="outline" className="h-11" onClick={reset}>
          Reset
        </Button>
      </div>

      {estimate ? (
        <VolumeEstimateResult estimate={estimate} />
      ) : null}
    </div>
  )
}
