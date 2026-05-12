"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SurferEditorDialog } from "@/components/surfers/surfer-editor-dialog"
import { getAdminSession } from "@/app/actions/account"

export function SurfersListAdminBar() {
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
        aria-label="Add surfer"
      >
        <Plus className="h-5 w-5" />
      </Button>
      <SurferEditorDialog open={open} onOpenChange={setOpen} mode="create" surfer={null} />
    </>
  )
}
