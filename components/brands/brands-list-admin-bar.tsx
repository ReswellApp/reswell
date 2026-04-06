"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BrandEditorDialog } from "@/components/brands/brand-editor-dialog"
import { getAdminSession } from "@/app/actions/account"

export function BrandsListAdminBar() {
  const [isAdmin, setIsAdmin] = React.useState(false)
  const [loaded, setLoaded] = React.useState(false)
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    getAdminSession()
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
      <Button
        type="button"
        size="icon"
        variant="default"
        className="h-10 w-10 shrink-0 rounded-full shadow-soft"
        onClick={() => setOpen(true)}
        aria-label="Add brand"
      >
        <Plus className="h-5 w-5" />
      </Button>
      <BrandEditorDialog open={open} onOpenChange={setOpen} mode="create" brand={null} />
    </>
  )
}
