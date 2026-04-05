"use client"

import * as React from "react"
import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { BrandRow } from "@/lib/brands/types"
import { BrandEditorDialog } from "@/components/brands/brand-editor-dialog"

export function BrandDetailAdminBar({ brand }: { brand: BrandRow }) {
  const [isAdmin, setIsAdmin] = React.useState(false)
  const [loaded, setLoaded] = React.useState(false)
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    fetch("/api/admin/session")
      .then((r) => r.json())
      .then((d: { isAdmin?: boolean }) => {
        if (!cancelled) {
          setIsAdmin(d.isAdmin === true)
          setLoaded(true)
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!loaded || !isAdmin) return null

  return (
    <>
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
      </div>
      <BrandEditorDialog open={open} onOpenChange={setOpen} mode="edit" brand={brand} />
    </>
  )
}
