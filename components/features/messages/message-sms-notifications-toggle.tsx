"use client"

import { useState } from "react"
import { MessageSmsPhoneCaptureDialog } from "@/components/features/messages/message-sms-phone-capture-dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

interface MessageSmsNotificationsToggleProps {
  initialOptIn: boolean
  initialPhone?: string | null
  className?: string
}

export function MessageSmsNotificationsToggle({
  initialOptIn,
  initialPhone,
  className,
}: MessageSmsNotificationsToggleProps) {
  const [optIn, setOptIn] = useState(initialOptIn)
  const [storedPhone, setStoredPhone] = useState(initialPhone?.trim() || null)
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false)
  const [dialogTargetEnabled, setDialogTargetEnabled] = useState(true)

  function handleChange(checked: boolean) {
    setDialogTargetEnabled(checked)
    setPhoneDialogOpen(true)
  }

  function handlePhoneCaptureSuccess(messageSmsOptIn: boolean, savedPhone: string) {
    const trimmed = savedPhone.trim()
    setStoredPhone(trimmed || null)
    setOptIn(messageSmsOptIn)
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
        <Switch
          id="message-sms-opt-in"
          checked={optIn}
          onCheckedChange={handleChange}
        />
      </div>

      <MessageSmsPhoneCaptureDialog
        open={phoneDialogOpen}
        onOpenChange={setPhoneDialogOpen}
        targetEnabled={dialogTargetEnabled}
        initialPhone={storedPhone}
        onSuccess={handlePhoneCaptureSuccess}
      />
    </>
  )
}
