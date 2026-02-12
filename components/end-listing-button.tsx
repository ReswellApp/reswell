"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
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
import { toast } from "sonner"

interface EndListingButtonProps {
  listingId: string
}

export function EndListingButton({ listingId }: EndListingButtonProps) {
  const [open, setOpen] = useState(false)
  const [choice, setChoice] = useState<"sold" | "removed" | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function handleConfirm() {
    if (!choice) return
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error("You need to be signed in.")
        return
      }

      const { error } = await supabase
        .from("listings")
        .update({
          status: choice,
          archived_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", listingId)
        .eq("user_id", user.id)

      if (error) {
        toast.error("Failed to end listing")
        return
      }

      toast.success(
        choice === "sold"
          ? "Listing marked as sold and archived"
          : "Listing removed and archived for 30 days"
      )
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
      <AlertDialog open={open} onOpenChange={(v) => { if (!v) { setOpen(false); setChoice(null) } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this listing?</AlertDialogTitle>
            <AlertDialogDescription>
              The listing will be archived for 30 days and then permanently deleted. Choose how you want to end it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Button
              variant={choice === "sold" ? "default" : "outline"}
              className="justify-start"
              type="button"
              onClick={() => setChoice("sold")}
            >
              Mark as sold
            </Button>
            <Button
              variant={choice === "removed" ? "default" : "outline"}
              className="justify-start"
              type="button"
              onClick={() => setChoice("removed")}
            >
              Remove listing (not sold)
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={!choice || loading}
            >
              {loading ? "Ending..." : "End listing"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

