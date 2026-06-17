"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { setMessageSmsNotificationsOptIn } from "@/app/actions/messageNotifications"
import { MessageSmsPhoneCaptureDialog } from "@/components/features/messages/message-sms-phone-capture-dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

interface MessageSmsNotificationsToggleProps {
  initialOptIn: boolean
  hasPhone: boolean
  className?: string
}

export function MessageSmsNotificationsToggle({
  initialOptIn,
  hasPhone: initialHasPhone,
  className,
}: MessageSmsNotificationsToggleProps) {
  const [optIn, setOptIn] = useState(initialOptIn)
  const [hasPhone, setHasPhone] = useState(initialHasPhone)
  const [pending, setPending] = useState(false)
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false)

  async function disableOptIn() {
    const previous = optIn
    setOptIn(false)
    setPending(true)

    try {
      const result = await setMessageSmsNotificationsOptIn(false)
      if (!result.ok) {
        setOptIn(previous)
        toast.error(result.error)
        return
      }
      setOptIn(result.message_sms_opt_in)
    } catch {
      setOptIn(previous)
      toast.error("Could not update text alert preference.")
    } finally {
      setPending(false)
    }
  }

  async function enableWithExistingPhone() {
    const previous = optIn
    setOptIn(true)
    setPending(true)

    try {
      const result = await setMessageSmsNotificationsOptIn(true)
      if (!result.ok) {
        setOptIn(previous)
        if (result.code === "missing_phone") {
          setHasPhone(false)
          setPhoneDialogOpen(true)
        } else {
          toast.error(result.error)
        }
        return
      }
      setOptIn(result.message_sms_opt_in)
    } catch {
      setOptIn(previous)
      toast.error("Could not update text alert preference.")
    } finally {
      setPending(false)
    }
  }

  function handleChange(checked: boolean) {
    if (pending) return

    if (!checked) {
      void disableOptIn()
      return
    }

    if (!hasPhone) {
      setPhoneDialogOpen(true)
      return
    }

    void enableWithExistingPhone()
  }

  function handlePhoneCaptureSuccess() {
    setHasPhone(true)
    setOptIn(true)
  }

  return (
    <>
      <div
        className={cn(
          "flex items-start justify-between gap-3 border-b border-border/60 px-3 py-3",
          className,
        )}
      >
        <div className="min-w-0 space-y-0.5">
          <Label htmlFor="message-sms-opt-in" className="text-[14px] font-medium text-foreground">
            Text me new messages
          </Label>
          <p className="text-[12px] leading-snug text-muted-foreground">
            Get an SMS when someone sends you a message on Reswell.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
          ) : null}
          <Switch
            id="message-sms-opt-in"
            checked={optIn}
            onCheckedChange={handleChange}
            disabled={pending}
          />
        </div>
      </div>

      <MessageSmsPhoneCaptureDialog
        open={phoneDialogOpen}
        onOpenChange={setPhoneDialogOpen}
        onSuccess={handlePhoneCaptureSuccess}
      />
    </>
  )
}
