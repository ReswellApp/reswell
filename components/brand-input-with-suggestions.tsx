"use client"

import { useEffect, useId, useState } from "react"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type BrandInputWithSuggestionsProps = {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  /** Show helper text under the field (default true). */
  showHint?: boolean
}

/**
 * Text field with optional datalist suggestions from `public.brands`.
 * Values are not validated against the table — users can type any brand.
 */
export function BrandInputWithSuggestions({
  id,
  value,
  onChange,
  placeholder,
  className,
  disabled,
  showHint = true,
}: BrandInputWithSuggestionsProps) {
  const listId = useId()
  const [options, setOptions] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    void (async () => {
      const { data, error } = await supabase.from("brands").select("name").order("name", { ascending: true })
      if (cancelled || error) return
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
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-1.5">
      <Input
        id={id}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
      {showHint ? (
        <p className="text-xs text-muted-foreground">
          Suggestions from our brand list — you can enter any brand; nothing has to match exactly.
        </p>
      ) : null}
    </div>
  )
}
