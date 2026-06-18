"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { saveMessageSmsNotificationsWithPhoneAction } from "@/app/actions/messageNotifications"
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
  targetEnabled: boolean
  initialPhone?: string | null
  onSuccess: (messageSmsOptIn: boolean, savedPhone: string) => void
}

export function MessageSmsPhoneCaptureDialog({
  open,
  onOpenChange,
  targetEnabled,
  initialPhone,
  onSuccess,
}: MessageSmsPhoneCaptureDialogProps) {
  const [phone, setPhone] = useState("")
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (open) {
      setPhone(initialPhone?.trim() ?? "")
    }
  }, [open, initialPhone])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (pending) return

    setPending(true)
    try {
      const result = await saveMessageSmsNotificationsWithPhoneAction({
        phone,
        enabled: targetEnabled,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(
        result.message_sms_opt_in ? "Text alerts enabled." : "Text alerts turned off.",
      )
      setPhone("")
      onOpenChange(false)
      onSuccess(result.message_sms_opt_in, phone.trim())
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
            <DialogTitle>
              {targetEnabled ? "Confirm your mobile number" : "Turn off text alerts"}
            </DialogTitle>
            <DialogDescription>
              {targetEnabled
                ? "Verify your number to receive SMS when someone sends you a message. Your number is saved under Addresses → Personal information."
                : "Confirm your mobile number to turn off message text alerts."}
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
            {targetEnabled ? (
              <p className="mt-3 text-[12px] leading-snug text-muted-foreground">
                By enabling, you agree to receive recurring marketing SMS from Reswell Inc. for
                message alerts when someone contacts you on Reswell. Message and data rates may
                apply. Reply STOP to opt out. See our{" "}
                <Link href="/mobile-terms" className="text-primary underline">
                  Mobile Terms of Service
                </Link>
                .
              </p>
            ) : null}
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
              ) : targetEnabled ? (
                "Save & enable texts"
              ) : (
                "Save & turn off texts"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
