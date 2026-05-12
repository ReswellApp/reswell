"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { SurferRow } from "@/lib/surfers/types"
import { SurferEditorDialog } from "@/components/surfers/surfer-editor-dialog"
import { getAdminSession } from "@/app/actions/account"
import { SURFERS_BASE } from "@/lib/surfers/routes"
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

export function SurferDetailAdminBar({ surfer }: { surfer: SurferRow }) {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = React.useState(false)
  const [loaded, setLoaded] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

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

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/surfers/${encodeURIComponent(surfer.slug)}`, {
        method: "DELETE",
        credentials: "include",
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not delete")
        return
      }
      toast.success("Profile removed")
      setDeleteOpen(false)
      router.push(SURFERS_BASE)
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }

  if (!loaded || !isAdmin) return null

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>
      <SurferEditorDialog open={editOpen} onOpenChange={setEditOpen} mode="edit" surfer={surfer} />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this profile?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {surfer.name} from the directory. The action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
