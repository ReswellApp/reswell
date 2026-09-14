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

interface SupportMacrosPickerProps {
  kindFilter?: string | null
  vars?: SupportMacroVars
  onInsert: (text: string) => void
  variant?: "chips" | "menu"
}

export function SupportMacrosPicker({
  kindFilter = null,
  vars = {},
  onInsert,
  variant = "chips",
}: SupportMacrosPickerProps) {
  const [macros, setMacros] = useState<SupportMacroRecord[]>([])

  const loadMacros = useCallback(async () => {
    const result = await listActiveSupportMacrosAction()
    if ("data" in result) setMacros(result.data)
  }, [])

  useEffect(() => {
    void loadMacros()
  }, [loadMacros])

  const visible = macros.filter(
    (macro) => !macro.kind_filter || !kindFilter || macro.kind_filter === kindFilter,
  )

  function insert(macro: SupportMacroRecord) {
    onInsert(applySupportMacroVars(macro.body, vars))
    toast.message(`Inserted “${macro.title}”`)
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
          {visible.map((macro) => (
            <DropdownMenuItem key={macro.id} onSelect={() => insert(macro)}>
              {macro.title}
            </DropdownMenuItem>
          ))}
          {visible.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No macros for this ticket.</p>
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

  if (visible.length === 0) {
    return (
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Reply macros</Label>
        <Link href="/admin/support-macros" className="text-xs text-muted-foreground underline">
          Add a macro
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">Reply macros</Label>
        <Link href="/admin/support-macros" className="text-[11px] text-muted-foreground underline">
          Manage
        </Link>
      </div>
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
