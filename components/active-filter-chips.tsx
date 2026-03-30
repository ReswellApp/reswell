"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ActiveFilterChipsProps {
  /** Base URL for the "Clear all" link (no query string). */
  clearHref: string
  /**
   * Param keys to never render as chips.
   * Defaults cover pagination and geocoding params that are implementation details.
   */
  ignore?: string[]
  className?: string
  /** Keys whose values should be wrapped in double-quotes, e.g. "search term". */
  quoteValues?: string[]
  /** Maps param keys to a string prefix prepended to the value, e.g. { size: "Size " }. */
  valuePrefixes?: Record<string, string>
  /** Maps param keys to a string suffix appended to the value, e.g. { leashLength: "ft" }. */
  valueSuffixes?: Record<string, string>
  /** Maps param keys to a dictionary for looking up a display label by raw value. */
  valueLookups?: Record<string, Record<string, string>>
}

export function ActiveFilterChips({
  clearHref,
  ignore = ["page", "lat", "lng", "radius"],
  className,
  quoteValues = [],
  valuePrefixes = {},
  valueSuffixes = {},
  valueLookups = {},
}: ActiveFilterChipsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const chips: { key: string; label: string }[] = []

  for (const [key, value] of searchParams.entries()) {
    if (ignore.includes(key)) continue
    if (!value || value === "all") continue

    let label: string
    if (quoteValues.includes(key)) {
      label = `"${value}"`
    } else {
      label = valueLookups[key]?.[value] ?? value
      label = (valuePrefixes[key] ?? "") + label + (valueSuffixes[key] ?? "")
    }

    chips.push({ key, label })
  }

  if (chips.length === 0) return null

  function removeParam(key: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete(key)
    params.delete("page")
    const qs = params.toString()
    startTransition(() => {
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false })
    })
  }

  return (
    <div className={cn("flex flex-wrap gap-2 items-center", className)}>
      {chips.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => removeParam(key)}
          className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-primary/10 text-primary text-sm rounded-full hover:bg-primary/20 transition-colors"
        >
          {label}
          <X className="h-3 w-3 ml-0.5 shrink-0" />
        </button>
      ))}
      <a
        href={clearHref}
        className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
      >
        Clear all
      </a>
    </div>
  )
}
