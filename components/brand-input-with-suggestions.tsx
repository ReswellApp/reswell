"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { RequestBrandDialog } from "@/components/request-brand-dialog"

type BrandInputWithSuggestionsProps = {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  /** Show helper text under the field (default true). */
  showHint?: boolean
  onBrandRequestSubmitted?: () => void
}

/**
 * Text field with optional datalist suggestions from `public.brands`.
 * Values are not validated against the table — users can type any brand.
 * When typed text matches no known brand name, offers "Request we add this brand" (same flow as legacy title field).
 */
export function BrandInputWithSuggestions({
  id,
  value,
  onChange,
  placeholder,
  className,
  disabled,
  showHint = true,
  onBrandRequestSubmitted,
}: BrandInputWithSuggestionsProps) {
  const listId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const [options, setOptions] = useState<string[]>([])
  const [catalogLoaded, setCatalogLoaded] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [requestOpen, setRequestOpen] = useState(false)
  const [requestSeedName, setRequestSeedName] = useState("")

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    void (async () => {
      const { data, error } = await supabase.from("brands").select("name").order("name", { ascending: true })
      if (cancelled || error) {
        if (!cancelled) setCatalogLoaded(true)
        return
      }
      const seen = new Set<string>()
      const names: string[] = []
      for (const row of data ?? []) {
        const n = typeof row.name === "string" ? row.name.trim() : ""
        if (!n || seen.has(n.toLowerCase())) continue
        seen.add(n.toLowerCase())
        names.push(n)
      }
      names.sort((a, b) => a.localeCompare(b))
      setOptions(names)
      setCatalogLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const q = value.trim()
  const filteredByQuery = useMemo(() => {
    if (!q) return []
    const ql = q.toLowerCase()
    return options.filter((name) => name.toLowerCase().includes(ql))
  }, [options, q])

  const showNoDirectoryMatchPanel =
    panelOpen &&
    catalogLoaded &&
    options.length > 0 &&
    q.length > 0 &&
    filteredByQuery.length === 0

  useEffect(() => {
    if (!showNoDirectoryMatchPanel) return
    const onDoc = (e: MouseEvent) => {
      const el = containerRef.current
      if (el && !el.contains(e.target as Node)) setPanelOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [showNoDirectoryMatchPanel])

  function openRequestDialog(seed: string) {
    setRequestSeedName(seed)
    setRequestOpen(true)
    setPanelOpen(false)
  }

  return (
    <div ref={containerRef} className="space-y-1.5">
      <div className="relative">
        <Input
          id={id}
          list={listId}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setPanelOpen(true)
          }}
          onFocus={() => setPanelOpen(true)}
          placeholder={placeholder}
          className={cn(className)}
          disabled={disabled}
          autoComplete="off"
        />
        <datalist id={listId}>
          {options.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        {showNoDirectoryMatchPanel ? (
          <div
            role="region"
            aria-label="Brand directory"
            className="absolute left-0 right-0 z-50 mt-1 max-h-[min(320px,50vh)] overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md"
          >
            <div className="space-y-2 p-3">
              <p className="text-sm text-muted-foreground">
                No brand in our directory matches &quot;{q}&quot;.
              </p>
              <Button
                type="button"
                variant="secondary"
                className="w-full min-h-touch"
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => openRequestDialog(q)}
              >
                Request we add this brand
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {showHint ? (
        <p className="text-xs text-muted-foreground">
          Suggestions from our brand list — you can enter any brand; nothing has to match exactly.
        </p>
      ) : null}
      <button
        type="button"
        className="text-xs text-primary underline-offset-4 hover:underline"
        onClick={() => openRequestDialog(value.trim())}
      >
        Brand not listed? Request we add it
      </button>

      <RequestBrandDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        defaultName={requestSeedName}
        onSubmitted={onBrandRequestSubmitted}
      />
    </div>
  )
}
