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
          "flex items-center justify-between gap-3 border-b border-border/50 px-3 py-2",
          className,
        )}
      >
        <div className="min-w-0">
          <Label htmlFor="message-sms-opt-in" className="text-[13px] font-medium text-foreground">
            Text me new messages
          </Label>
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
