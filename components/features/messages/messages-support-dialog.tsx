"use client"

import { useState, useTransition } from "react"
import { LifeBuoy, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { submitMessagesSupportTicketAction } from "@/lib/actions/messagesSupportTicket"
import {
  messagesSupportTopicLabels,
  type MessagesSupportTopic,
} from "@/lib/validations/messagesSupportTicket"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const TOPIC_KEYS = Object.keys(messagesSupportTopicLabels) as MessagesSupportTopic[]

interface MessagesSupportDialogProps {
  /** When set (e.g. on a chat thread), the ticket links to this conversation for your team. */
  relatedConversationId?: string | null
  /** `floating`: prominent pill with icon + label (position with floatingTriggerClassName). */
  triggerMode?: "default" | "floating"
  triggerClassName?: string
  /** Appended to the floating trigger (e.g. absolute inset) — only when triggerMode is floating. */
  floatingTriggerClassName?: string
  /** Short label shown on the floating pill (default: Help). */
  floatingLabel?: string
  variant?: "default" | "outline" | "ghost" | "secondary"
  size?: "default" | "sm" | "lg"
  triggerLabel?: string
}

export function MessagesSupportDialog({
  relatedConversationId = null,
  triggerMode = "default",
  triggerClassName,
  floatingTriggerClassName,
  floatingLabel = "Help",
  variant = "outline",
  size = "default",
  triggerLabel = "Need help?",
}: MessagesSupportDialogProps) {
  const [open, setOpen] = useState(false)
  const [topic, setTopic] = useState<MessagesSupportTopic>("general")
  const [details, setDetails] = useState("")
  const [pending, startTransition] = useTransition()

  function reset() {
    setTopic("general")
    setDetails("")
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) reset()
  }

  function submit() {
    startTransition(async () => {
      const res = await submitMessagesSupportTicketAction({
        topic,
        details,
        related_conversation_id: relatedConversationId,
      })
      if ("error" in res && res.error) {
        toast.error(res.error)
        return
      }
      if ("success" in res && res.success) {
        toast.success("Thanks — we received your message and will get back to you soon.")
        handleOpenChange(false)
      }
    })
  }

  const floatingTrigger = (
    <Button
      type="button"
      variant="default"
      className={cn(
        "pointer-events-auto h-12 shrink-0 gap-2 rounded-full px-4 text-sm font-semibold shadow-[0_4px_20px_rgba(17,17,17,0.18)] transition-[box-shadow,transform] hover:shadow-[0_6px_28px_rgba(17,17,17,0.22)] active:scale-[0.98] dark:shadow-black/35 dark:hover:shadow-black/45",
        floatingTriggerClassName,
      )}
      aria-label={`${floatingLabel} — contact Reswell support`}
    >
      <LifeBuoy className="h-[1.125rem] w-[1.125rem] shrink-0 opacity-95" aria-hidden />
      <span className="max-w-[7.5rem] truncate sm:max-w-none">{floatingLabel}</span>
    </Button>
  )

  return (
    <TooltipProvider delayDuration={400}>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {triggerMode === "floating" ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>{floatingTrigger}</DialogTrigger>
            </TooltipTrigger>
            <TooltipContent side="left" align="center" className="max-w-[220px] text-center leading-snug">
              Get help from Reswell — billing, orders, safety, and more
            </TooltipContent>
          </Tooltip>
        ) : (
          <DialogTrigger asChild>
            <Button
              type="button"
              variant={variant}
              size={size}
              className={cn("gap-2 rounded-full font-medium", triggerClassName)}
            >
              <LifeBuoy className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              {triggerLabel}
            </Button>
          </DialogTrigger>
        )}
      <DialogContent className="max-h-[min(90vh,640px)] gap-0 overflow-y-auto sm:max-w-md">
        <DialogHeader className="space-y-2 pb-2 text-left">
          <DialogTitle className="text-xl">Contact Reswell</DialogTitle>
          <DialogDescription className="text-[15px] leading-relaxed">
            Tell us what you need. This opens a support ticket our team sees in the same inbox as the contact
            form — no need to leave Messages.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {relatedConversationId ? (
            <p className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-[13px] leading-snug text-muted-foreground">
              This ticket will include a link to this chat so we can see the full context.
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="support-topic">What can we help with?</Label>
            <Select value={topic} onValueChange={(v) => setTopic(v as MessagesSupportTopic)}>
              <SelectTrigger id="support-topic" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOPIC_KEYS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {messagesSupportTopicLabels[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="support-details">Details</Label>
            <Textarea
              id="support-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Describe what happened, relevant order or listing details, and what you’d like us to do."
              rows={6}
              className="resize-y min-h-[120px] text-[15px] leading-relaxed"
              maxLength={10000}
            />
            <p className="text-[11px] text-muted-foreground">{details.trim().length} / 10000</p>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-border/60 pt-4 sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={pending || details.trim().length < 10}>
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Sending…
              </>
            ) : (
              "Send to Reswell"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </TooltipProvider>
  )
}
