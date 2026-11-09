"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { removeBalanceSheetItemAction } from "@/lib/actions/sellerBalanceSheet"

interface RemoveBalanceSheetItemButtonProps {
  listingId: string
  listingTitle: string
  display?: "icon" | "button"
}

export function RemoveBalanceSheetItemButton({
  listingId,
  listingTitle,
  display = "icon",
}: RemoveBalanceSheetItemButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function removeItem(): void {
    startTransition(async () => {
      const result = await removeBalanceSheetItemAction({ listingId })

      if ("error" in result) {
        toast.error(result.error)
        return
      }

      setOpen(false)
      toast.success("Item removed from balance sheet")
      router.refresh()
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {display === "icon" ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove ${listingTitle} from balance sheet`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm">
            <Trash2 className="mr-1.5 h-4 w-4" />
            Remove
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove from balance sheet?</AlertDialogTitle>
          <AlertDialogDescription>
            {listingTitle} will be excluded from this balance sheet and its totals. The listing
            and any related order records will not be deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault()
              removeItem()
            }}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
