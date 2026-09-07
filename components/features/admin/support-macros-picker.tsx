"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { SupportMacroRow } from "@/lib/db/supportCases"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

function applyMacroVars(
  body: string,
  vars: { name?: string; order_ref?: string },
): string {
  return body
    .replaceAll("{{name}}", vars.name?.trim() || "there")
    .replaceAll("{{order_ref}}", vars.order_ref?.trim() || "your order")
}

interface SupportMacrosPickerProps {
  kindFilter?: string | null
  vars?: { name?: string; order_ref?: string }
  onInsert: (text: string) => void
}

export function SupportMacrosPicker({
  kindFilter = null,
  vars = {},
  onInsert,
}: SupportMacrosPickerProps) {
  const [macros, setMacros] = useState<SupportMacroRow[]>([])

  useEffect(() => {
    const supabase = createClient()
    void supabase
      .from("support_macros")
      .select("id, title, body, kind_filter, is_active, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (data) setMacros(data as SupportMacroRow[])
      })
  }, [])

  const visible = macros.filter(
    (m) => !m.kind_filter || !kindFilter || m.kind_filter === kindFilter,
  )

  if (visible.length === 0) return null

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Reply macros</Label>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((m) => (
          <Button
            key={m.id}
            type="button"
            size="sm"
            variant="outline"
            className="h-7 rounded-full text-xs"
            onClick={() => {
              const text = applyMacroVars(m.body, vars)
              onInsert(text)
              toast.message(`Inserted “${m.title}”`)
            }}
          >
            {m.title}
          </Button>
        ))}
      </div>
    </div>
  )
}
