"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Settings2, Zap } from "lucide-react"
import { listActiveSupportMacrosAction } from "@/lib/actions/supportMacros"
import type { SupportMacroRecord } from "@/lib/db/supportMacros"
import {
  applySupportMacroVars,
  type SupportMacroVars,
} from "@/lib/utils/apply-support-macro-vars"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

function macroNeedsOrderVars(body: string): boolean {
  return body.includes("{{tracking}}") || body.includes("{{order_status}}")
}

interface SupportMacrosPickerProps {
  kindFilter?: string | null
  vars?: SupportMacroVars
  onInsert: (text: string) => void
  variant?: "chips" | "menu"
  /** False while a linked order is still loading for substitution. */
  orderVarsReady?: boolean
  /** True when tracking / fulfillment fields are available. */
  hasOrderVars?: boolean
}

export function SupportMacrosPicker({
  kindFilter = null,
  vars = {},
  onInsert,
  variant = "chips",
  orderVarsReady = true,
  hasOrderVars = true,
}: SupportMacrosPickerProps) {
  const [macros, setMacros] = useState<SupportMacroRecord[] | null>(null)

  const loadMacros = useCallback(async () => {
    const result = await listActiveSupportMacrosAction()
    if ("data" in result) setMacros(result.data)
  }, [])

  useEffect(() => {
    void loadMacros()
  }, [loadMacros])

  const list = macros ?? []
  const loaded = macros !== null
  const visible = list.filter(
    (macro) => !macro.kind_filter || !kindFilter || macro.kind_filter === kindFilter,
  )

  function insert(macro: SupportMacroRecord) {
    if (!orderVarsReady) {
      toast.message("Loading order details…")
      return
    }
    if (macroNeedsOrderVars(macro.body) && !hasOrderVars) {
      toast.error("Order details are not available for this ticket.")
      return
    }
    onInsert(applySupportMacroVars(macro.body, vars))
    toast.message(`Inserted “${macro.title}”`)
  }

  function emptyCopy(): string {
    if (!loaded) return "Loading macros…"
    if (list.length === 0) return "No macros yet."
    return "No macros for this ticket."
  }

  if (variant === "menu") {
    return (
      <DropdownMenu onOpenChange={(open) => { if (open) void loadMacros() }}>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="sm" variant="ghost" className="h-8 gap-1.5 px-2 text-xs">
            <Zap className="h-3.5 w-3.5" aria-hidden />
            Macros
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 w-64 overflow-y-auto">
          {!orderVarsReady ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">Loading order details…</p>
          ) : null}
          {visible.map((macro) => (
            <DropdownMenuItem
              key={macro.id}
              disabled={!orderVarsReady || (macroNeedsOrderVars(macro.body) && !hasOrderVars)}
              onSelect={() => insert(macro)}
            >
              {macro.title}
            </DropdownMenuItem>
          ))}
          {visible.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">{emptyCopy()}</p>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/admin/support-macros" className="gap-1.5">
              <Settings2 className="h-3.5 w-3.5" aria-hidden />
              Manage macros
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">Reply macros</Label>
        <Link href="/admin/support-macros" className="text-[11px] text-muted-foreground underline">
          {list.length === 0 && loaded ? "Add a macro" : "Manage"}
        </Link>
      </div>
      {!loaded || visible.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyCopy()}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {visible.map((macro) => (
            <Button
              key={macro.id}
              type="button"
              size="sm"
              variant="outline"
              className="h-7 rounded-full text-xs"
              disabled={!orderVarsReady || (macroNeedsOrderVars(macro.body) && !hasOrderVars)}
              onClick={() => insert(macro)}
            >
              {macro.title}
            </Button>
          ))}
        </div>
      )}
      {!orderVarsReady ? (
        <p className="text-[11px] text-muted-foreground">Loading order details…</p>
      ) : null}
    </div>
  )
}
