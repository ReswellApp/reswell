"use client"

import { useEffect, useState } from "react"
import { Zap } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { SupportMacroRow } from "@/lib/db/supportCases"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  variant?: "chips" | "menu"
}

export function SupportMacrosPicker({
  kindFilter = null,
  vars = {},
  onInsert,
  variant = "chips",
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

  function insert(macro: SupportMacroRow) {
    onInsert(applyMacroVars(macro.body, vars))
    toast.message(`Inserted “${macro.title}”`)
  }

  if (variant === "menu") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="sm" variant="ghost" className="h-8 gap-1.5 px-2 text-xs">
            <Zap className="h-3.5 w-3.5" aria-hidden />
            Macros
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 w-64 overflow-y-auto">
          {visible.map((macro) => (
            <DropdownMenuItem key={macro.id} onSelect={() => insert(macro)}>
              {macro.title}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Reply macros</Label>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((macro) => (
          <Button
            key={macro.id}
            type="button"
            size="sm"
            variant="outline"
            className="h-7 rounded-full text-xs"
            onClick={() => insert(macro)}
          >
            {macro.title}
          </Button>
        ))}
      </div>
    </div>
  )
}
