"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  createSupportMacroAction,
  deleteSupportMacroAction,
  updateSupportMacroAction,
} from "@/lib/actions/supportMacros"
import type { SupportMacroRecord } from "@/lib/db/supportMacros"
import { SUPPORT_CASE_KIND_LABEL } from "@/lib/utils/support-case-display"
import { SupportMacroEditor } from "@/components/features/admin/support-macros/support-macro-editor"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SupportMacrosAdminClientProps {
  initialMacros: SupportMacroRecord[]
}

export function SupportMacrosAdminClient({ initialMacros }: SupportMacrosAdminClientProps) {
  const [macros, setMacros] = useState(initialMacros)
  const [selectedId, setSelectedId] = useState<string | "new" | null>(null)
  const [pending, setPending] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const selected = selectedId && selectedId !== "new" ? macros.find((row) => row.id === selectedId) ?? null : null

  async function handleSave(input: {
    title: string
    body: string
    kind_filter: string | null
    is_active: boolean
    sort_order: number
  }) {
    setPending(true)
    const result = selected
      ? await updateSupportMacroAction({ id: selected.id, ...input })
      : await createSupportMacroAction(input)
    setPending(false)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    setMacros((prev) => {
      const next = selected
        ? prev.map((row) => (row.id === result.data.id ? result.data : row))
        : [...prev, result.data]
      return next.sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title))
    })
    setSelectedId(result.data.id)
    toast.success(selected ? "Macro saved" : "Macro added")
  }

  async function handleDelete() {
    if (!deleteId) return
    setPending(true)
    const result = await deleteSupportMacroAction({ id: deleteId })
    setPending(false)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    setMacros((prev) => prev.filter((row) => row.id !== deleteId))
    setSelectedId(null)
    setDeleteId(null)
    toast.success("Macro deleted")
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
      <div className="space-y-2">
        <Button type="button" size="sm" onClick={() => setSelectedId("new")}>
          New macro
        </Button>
        <ul className="overflow-hidden rounded-lg border bg-card">
          {macros.map((macro) => (
            <li key={macro.id} className="border-b last:border-0">
              <button
                type="button"
                onClick={() => setSelectedId(macro.id)}
                className={cn(
                  "flex w-full flex-col items-start gap-1 px-3 py-2.5 text-left text-sm hover:bg-muted/60",
                  selectedId === macro.id && "bg-muted",
                )}
              >
                <span className="font-medium">{macro.title}</span>
                <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  {macro.kind_filter
                    ? (SUPPORT_CASE_KIND_LABEL[macro.kind_filter as keyof typeof SUPPORT_CASE_KIND_LABEL] ??
                      macro.kind_filter)
                    : "All kinds"}
                  {!macro.is_active ? <Badge variant="outline">Inactive</Badge> : null}
                </span>
              </button>
            </li>
          ))}
          {macros.length === 0 ? (
            <li className="px-3 py-8 text-sm text-muted-foreground">
              No macros yet. Add a shipping delay reply or anything else Hayden sends often.
            </li>
          ) : null}
        </ul>
      </div>
      {selectedId === "new" || selected ? (
        <SupportMacroEditor
          key={selected?.id ?? "new"}
          macro={selected}
          pending={pending}
          onSave={handleSave}
          onDelete={selected ? () => setDeleteId(selected.id) : undefined}
          onCancel={() => setSelectedId(null)}
        />
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-10 text-sm text-muted-foreground">
          Select a macro to edit, or create one. Changes show in the inbox picker as soon as they are
          active.
        </p>
      )}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this macro?</AlertDialogTitle>
            <AlertDialogDescription>
              It will disappear from the inbox picker. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
