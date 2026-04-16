"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { postEndListing } from "@/lib/listing-end-request"

interface EndListingButtonProps {
  listingId: string
}

type EndChoice = "delete" | "archive" | null

export function EndListingButton({ listingId }: EndListingButtonProps) {
  const [open, setOpen] = useState(false)
  const [choice, setChoice] = useState<EndChoice>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleConfirm() {
    if (!choice) return
    setLoading(true)
    try {
      const result = await postEndListing(listingId, choice)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      if (result.mode === "delete") {
        toast.success("Listing deleted")
        router.push("/dashboard/listings")
        return
      }

      toast.success("Listing archived for 30 days")
      router.push("/dashboard/listings/archived")
    } finally {
      setLoading(false)
      setOpen(false)
      setChoice(null)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={loading}
      >
        End listing
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(v) => {
          if (!v) {
            setOpen(false)
            setChoice(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End listing</AlertDialogTitle>
            <AlertDialogDescription>
              Archive keeps your listing for 30 days in Archived listings; after that, it can’t be
              recovered. Delete removes it permanently right away. Choose an option:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Button
              variant={choice === "archive" ? "default" : "outline"}
              className="justify-start"
              type="button"
              onClick={() => setChoice("archive")}
            >
              Archive listing
            </Button>
            <Button
              variant={choice === "delete" ? "destructive" : "outline"}
              className="justify-start"
              type="button"
              onClick={() => setChoice("delete")}
            >
              Delete listing
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant={choice === "delete" ? "destructive" : "default"}
              disabled={!choice || loading}
              onClick={() => void handleConfirm()}
            >
              {loading
                ? choice === "delete"
                  ? "Deleting…"
                  : "Archiving…"
                : choice === "delete"
                  ? "Delete listing"
                  : choice === "archive"
                    ? "Archive listing"
                    : "Continue"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
