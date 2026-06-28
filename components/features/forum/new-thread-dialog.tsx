"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { NewThreadForm } from "@/components/forum/new-thread-form"

type NewThreadDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NewThreadDialog({ open, onOpenChange }: NewThreadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Start a new thread</DialogTitle>
          <DialogDescription>
            Share a question, story, link, or photo idea — the community is listening.
          </DialogDescription>
        </DialogHeader>
        <NewThreadForm onCreated={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
