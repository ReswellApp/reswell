"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RotateCcw } from "lucide-react"
import { toast } from "sonner"
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
import { postRelistListing } from "@/lib/listing-relist-request"
import { cn } from "@/lib/utils"

interface RelistListingButtonProps {
  listingId: string
  triggerLabel?: string
  triggerSize?: "sm" | "default"
  triggerVariant?: "secondary" | "outline" | "ghost" | "default"
  triggerClassName?: string
  showIcon?: boolean
  onSuccess?: () => void
}

export function RelistListingButton({
  listingId,
  triggerLabel = "Relist",
  triggerSize = "sm",
  triggerVariant = "secondary",
  triggerClassName,
  showIcon = true,
  onSuccess,
}: RelistListingButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleRelist() {
    setLoading(true)
    try {
      const result = await postRelistListing(listingId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Listing is live again")
      setOpen(false)
      onSuccess?.()
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        size={triggerSize}
        variant={triggerVariant}
        className={cn(triggerClassName)}
        onClick={() => setOpen(true)}
      >
        {showIcon ? <RotateCcw className="h-3.5 w-3.5" aria-hidden /> : null}
        {triggerLabel}
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (loading && !nextOpen) return
          setOpen(nextOpen)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Relist this item?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be available to buy again. Use this if you marked it sold by accident.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <Button type="button" disabled={loading} onClick={() => void handleRelist()}>
              {loading ? "Relisting…" : "Relist"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
