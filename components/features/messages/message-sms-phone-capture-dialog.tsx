"use client"

import Link from "next/link"
import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { enableMessageSmsNotificationsWithPhoneAction } from "@/app/actions/messageNotifications"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface MessageSmsPhoneCaptureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function MessageSmsPhoneCaptureDialog({
  open,
  onOpenChange,
  onSuccess,
}: MessageSmsPhoneCaptureDialogProps) {
  const [phone, setPhone] = useState("")
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (pending) return

    setPending(true)
    try {
      const result = await enableMessageSmsNotificationsWithPhoneAction(phone)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Text alerts enabled.")
      setPhone("")
      onOpenChange(false)
      onSuccess()
    } catch {
      toast.error("Could not save your phone number.")
    } finally {
      setPending(false)
    }
  }

  function handleOpenChange(next: boolean) {
    if (pending) return
    if (!next) {
      setPhone("")
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add your mobile number</DialogTitle>
            <DialogDescription>
              We&apos;ll text you when someone sends a message. Your number is saved under Addresses →
              Personal information.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label htmlFor="message-sms-phone">Mobile number</Label>
            <Input
              id="message-sms-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(555) 555-5555"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mt-2"
              disabled={pending}
              autoFocus
            />
            <p className="mt-3 text-[12px] leading-snug text-muted-foreground">
              By enabling, you agree to receive recurring SMS from Reswell Inc. Message and data
              rates may apply. Reply STOP to opt out. See our{" "}
              <Link href="/mobile-terms" className="text-primary underline">
                Mobile Terms of Service
              </Link>
              .
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !phone.trim()}>
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                "Save & enable texts"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
