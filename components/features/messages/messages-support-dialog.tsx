"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LifeBuoy, Loader2, ArrowLeft, ChevronRight, MessageCircle } from "lucide-react"
import { toast } from "sonner"
import { submitMessagesSupportTicketAction } from "@/lib/actions/messagesSupportTicket"
import {
  messagesSupportTopicLabels,
  type MessagesSupportTopic,
} from "@/lib/validations/messagesSupportTicket"
import {
  journeyNodeShowsResolution,
  journeyOptionsForTopic,
  formatTicketDetailsWithJourney,
  type SupportJourneyNode,
} from "@/lib/messages/support-journey-config"
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
import { cn } from "@/lib/utils"

const TOPIC_KEYS = Object.keys(messagesSupportTopicLabels) as MessagesSupportTopic[]

const TOPIC_HINTS: Record<MessagesSupportTopic, string> = {
  general: "Buying, selling, fees, messages",
  account: "Profile, login, earnings & payouts",
  buying_selling: "Offers, shipping, purchases, listings",
  payments: "Checkout, wallet, cash out, fees",
  safety: "Scams, meetups, harassment",
  other: "Doesn’t fit the categories above",
}

type SupportPhase = "browse" | "resolution" | "freeform"

type JourneyStackFrame =
  | { kind: "topics" }
  | { kind: "options"; topic: MessagesSupportTopic; nodes: SupportJourneyNode[] }

interface MessagesSupportDialogProps {
  relatedConversationId?: string | null
  triggerMode?: "default" | "floating"
  triggerClassName?: string
  floatingTriggerClassName?: string
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
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [stack, setStack] = useState<JourneyStackFrame[]>([{ kind: "topics" }])
  const [pathTitles, setPathTitles] = useState<string[]>([])
  const [phase, setPhase] = useState<SupportPhase>("browse")
  const [resolutionNode, setResolutionNode] = useState<SupportJourneyNode | null>(null)
  const [topic, setTopic] = useState<MessagesSupportTopic>("general")
  const [details, setDetails] = useState("")
  const [pending, startTransition] = useTransition()

  function resetJourney() {
    setStack([{ kind: "topics" }])
    setPathTitles([])
    setPhase("browse")
    setResolutionNode(null)
    setTopic("general")
    setDetails("")
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) resetJourney()
  }

  function selectTopic(t: MessagesSupportTopic) {
    setTopic(t)
    setStack([{ kind: "topics" }, { kind: "options", topic: t, nodes: journeyOptionsForTopic(t) }])
    setPathTitles([])
    setPhase("browse")
    setResolutionNode(null)
  }

  function pickNode(node: SupportJourneyNode) {
    const frame = stack[stack.length - 1]
    if (frame.kind !== "options") return
    const { topic: currentTopic } = frame
    setTopic(currentTopic)

    if (node.choices?.length) {
      setStack((s) => [...s, { kind: "options", topic: currentTopic, nodes: node.choices! }])
      setPathTitles((p) => [...p, node.title])
      return
    }
    if (journeyNodeShowsResolution(node)) {
      setPathTitles((p) => [...p, node.title])
      setResolutionNode(node)
      setPhase("resolution")
      return
    }
    setPathTitles((p) => [...p, node.title])
    setPhase("freeform")
  }

  function goBack() {
    if (phase === "resolution") {
      setResolutionNode(null)
      setPhase("browse")
      setPathTitles((p) => p.slice(0, -1))
      return
    }
    if (phase === "freeform") {
      if (resolutionNode) {
        setPhase("resolution")
        return
      }
      setPhase("browse")
      setPathTitles((p) => p.slice(0, -1))
      return
    }
    if (stack.length <= 1) {
      handleOpenChange(false)
      return
    }
    setStack((s) => s.slice(0, -1))
    setPathTitles((p) => p.slice(0, -1))
  }

  function sendSupportTicket(formattedDetails: string) {
    startTransition(async () => {
      const res = await submitMessagesSupportTicketAction({
        topic,
        details: formattedDetails,
        related_conversation_id: relatedConversationId,
      })
      if ("error" in res && res.error) {
        toast.error(res.error)
        return
      }
      if ("success" in res && res.success) {
        toast.success(
          res.id
            ? "Ticket sent — opening your support request."
            : "Thanks — we received your message and will get back to you soon.",
        )
        handleOpenChange(false)
        if (res.id) {
          router.push(`/dashboard/support/${res.id}`)
        } else {
          router.push("/dashboard/support")
        }
      }
    })
  }

  function submit() {
    const userPart = resolutionNode
      ? [`What we showed them first:`, resolutionNode.resolution, "", `Their message:`, details.trim()].join(
          "\n",
        )
      : details.trim()
    const body = formatTicketDetailsWithJourney(topic, pathTitles, userPart)
    sendSupportTicket(body)
  }

  /** Skip self-serve paths and compose a message to the team (same submit as “Send to Reswell”). */
  function askSomeoneNow() {
    setResolutionNode(null)
    setDetails("")
    setPhase("freeform")
  }

  const floatingTrigger = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "pointer-events-auto h-10 w-10 shrink-0 rounded-full border border-border/45 bg-white/70 text-[17px] font-semibold leading-none text-foreground/80 shadow-sm backdrop-blur-sm transition-[opacity,transform,background-color] hover:bg-white/85 hover:text-foreground active:scale-[0.98] dark:border-white/15 dark:bg-white/75 dark:text-foreground/85 dark:hover:bg-white/90",
        floatingTriggerClassName,
      )}
      aria-label={`${floatingLabel} — contact Reswell support`}
    >
      <span aria-hidden>?</span>
    </Button>
  )

  const topFrame = stack[stack.length - 1]
  const onTopicPick = topFrame.kind === "topics" && phase === "browse"
  const optionNodes = topFrame.kind === "options" ? topFrame.nodes : []
  const breadcrumb =
    pathTitles.length > 0 ? `${messagesSupportTopicLabels[topic]} → ${pathTitles.join(" → ")}` : null

  const mobileSubtitle = onTopicPick
    ? "Pick a topic, or ask our team below."
    : phase === "freeform"
      ? "Tell us what happened — we’ll open a Support ticket."
      : phase === "resolution"
        ? "Try this first, or message our team."
        : "Pick the closest match, or ask our team below."

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {triggerMode === "floating" ? (
        <DialogTrigger asChild>{floatingTrigger}</DialogTrigger>
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
        <DialogContent
          overlayClassName="z-[70]"
          className={cn(
            "z-[70] flex max-w-md flex-col gap-0 overflow-hidden p-0",
            "max-sm:!fixed max-sm:!left-1/2 max-sm:!top-1/2 max-sm:!right-auto max-sm:!bottom-auto max-sm:!m-0",
            "max-sm:!h-[min(27rem,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem))]",
            "max-sm:!max-h-[min(27rem,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem))]",
            "max-sm:!w-[calc(100%-1rem)] max-sm:!max-w-md max-sm:!-translate-x-1/2 max-sm:!-translate-y-1/2 max-sm:rounded-xl",
            "max-sm:[--tw-enter-translate-x:0] max-sm:[--tw-enter-translate-y:0]",
            "max-sm:[--tw-exit-translate-x:0] max-sm:[--tw-exit-translate-y:0]",
            "max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=closed]:zoom-out-100",
            "max-sm:data-[state=open]:slide-in-from-left-0 max-sm:data-[state=closed]:slide-out-to-left-0",
            "max-sm:data-[state=open]:slide-in-from-top-0 max-sm:data-[state=closed]:slide-out-to-top-0",
            "sm:w-[calc(100%-1rem)] sm:max-h-[min(92vh,680px)] sm:min-h-0 sm:overflow-y-auto sm:p-6",
          )}
        >
          <DialogHeader className="shrink-0 space-y-1 px-3 pb-1 pt-3 pr-10 text-left sm:space-y-2 sm:px-0 sm:pb-2 sm:pr-0 sm:pt-0">
            {phase !== "browse" || !onTopicPick ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mb-0 -ml-1 h-7 w-fit gap-1 px-1.5 text-muted-foreground hover:text-foreground sm:mb-1 sm:-ml-2 sm:h-8 sm:px-2"
                onClick={goBack}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                <span className="sr-only sm:not-sr-only">Back</span>
              </Button>
            ) : null}
            <DialogTitle className="text-lg sm:text-xl">Contact Reswell</DialogTitle>
            <DialogDescription className="max-sm:sr-only text-[13px] leading-snug sm:text-[15px] sm:leading-relaxed">
              {onTopicPick
                ? "Choose a topic to see quick answers tailored to your question. You can still message our team anytime at the end."
                : phase === "freeform"
                  ? "Tell us what’s going on. We’ll open a Support ticket (under Support, not Messages) and follow up there."
                  : phase === "resolution"
                    ? "Here’s something that helps most people with this."
                    : "Pick the option that best matches what you need."}
            </DialogDescription>
            <p className="text-[13px] leading-snug text-muted-foreground sm:hidden">{mobileSubtitle}</p>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-2 sm:space-y-4 sm:overflow-visible sm:px-0 sm:py-4">
            {relatedConversationId ? (
              <p className="rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5 text-[11px] leading-snug text-muted-foreground sm:rounded-xl sm:px-3 sm:py-2 sm:text-[13px]">
                This ticket will include a link to this chat so we can see the full context.
              </p>
            ) : null}

            {breadcrumb ? (
              <p className="hidden text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:block">
                {breadcrumb}
              </p>
            ) : null}

            {/* Topic grid */}
            {onTopicPick ? (
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                {TOPIC_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectTopic(key)}
                    className={cn(
                      "flex min-h-0 flex-col items-start gap-0 rounded-xl border border-border/70 bg-card px-2.5 py-2 text-left shadow-sm transition-colors sm:min-h-[4.25rem] sm:gap-0.5 sm:rounded-2xl sm:px-4 sm:py-3",
                      "hover:border-foreground/15 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                  >
                    <span className="text-[12px] font-semibold leading-tight text-foreground sm:text-[15px] sm:leading-snug">
                      {messagesSupportTopicLabels[key]}
                    </span>
                    <span className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-muted-foreground sm:text-[13px] sm:leading-snug">
                      {TOPIC_HINTS[key]}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            {/* Journey options */}
            {topFrame.kind === "options" && phase === "browse" ? (
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-[12px] text-muted-foreground sm:text-[13px]">What matches best?</Label>
                <ul className="space-y-1.5 sm:space-y-2" role="list">
                  {optionNodes.map((node) => (
                    <li key={node.id}>
                      <button
                        type="button"
                        onClick={() => pickNode(node)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-xl border border-border/70 bg-card px-2.5 py-1.5 text-left shadow-sm transition-colors sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-3",
                          "hover:border-foreground/15 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12px] font-semibold leading-tight text-foreground sm:text-[15px] sm:leading-snug">
                            {node.title}
                          </span>
                          {node.hint ? (
                            <span className="mt-0.5 block text-[10px] leading-tight text-muted-foreground sm:text-[13px] sm:leading-snug">
                              {node.hint}
                            </span>
                          ) : null}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground sm:h-5 sm:w-5" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Resolution */}
            {phase === "resolution" && resolutionNode ? (
              <div className="space-y-2 sm:space-y-4">
                <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2 sm:rounded-2xl sm:px-4 sm:py-3">
                  <p className="text-[13px] leading-snug text-foreground sm:text-[15px] sm:leading-relaxed">
                    {resolutionNode.resolution}
                  </p>
                  {resolutionNode.helpHref ? (
                    <Button variant="link" className="mt-1 h-auto px-0 text-[13px] text-primary sm:mt-2 sm:text-sm" asChild>
                      <Link href={resolutionNode.helpHref}>
                        {resolutionNode.helpLinkLabel ?? "Learn more"}
                      </Link>
                    </Button>
                  ) : null}
                </div>
                <div className="flex flex-row flex-wrap gap-1.5 sm:flex-col sm:gap-2 md:flex-row md:flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      toast.message("Great — we’re glad that helped.")
                      handleOpenChange(false)
                    }}
                  >
                    That solved it
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setPhase("freeform")}
                  >
                    I still need help
                  </Button>
                </div>
              </div>
            ) : null}

            {/* Free-form */}
            {phase === "freeform" ? (
              <div className="space-y-1.5 sm:space-y-2">
                {resolutionNode ? (
                  <p className="rounded-lg border border-border/60 bg-muted/25 px-2.5 py-1.5 text-[11px] leading-snug text-muted-foreground sm:rounded-xl sm:px-3 sm:py-2 sm:text-[13px]">
                    We’ll share your note with our team along with the help snippet above.
                  </p>
                ) : null}
                <Label htmlFor="support-details" className="text-[12px] sm:text-sm">
                  Your message
                </Label>
                <Textarea
                  id="support-details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Add purchase or order numbers, listing links, what you expected, and what happened instead. The more detail, the faster we can help."
                  rows={4}
                  className="min-h-[72px] resize-none text-[14px] leading-snug sm:min-h-[120px] sm:text-[15px] sm:leading-relaxed sm:resize-y"
                  maxLength={10000}
                />
                <p className="text-[10px] text-muted-foreground sm:text-[11px]">{details.trim().length} / 10000</p>
              </div>
            ) : null}
          </div>

          <DialogFooter className="shrink-0 flex-row flex-nowrap items-center justify-between gap-2 border-t border-border/60 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:justify-between sm:px-0 sm:pb-0 sm:pt-4">
            {phase === "freeform" ? (
              <>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleOpenChange(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={submit} disabled={pending || details.trim().length < 10}>
                  {pending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      Sending…
                    </>
                  ) : (
                    "Send to Reswell"
                  )}
                </Button>
              </>
            ) : phase === "resolution" ? (
              <Button type="button" variant="ghost" size="sm" className="sm:ml-auto" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            ) : (
              <>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleOpenChange(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button type="button" size="sm" className="gap-1.5 rounded-full px-3 sm:gap-2 sm:px-4" onClick={askSomeoneNow}>
                  <MessageCircle className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
                  Ask someone now
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
    </Dialog>
  )
}
