"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LifeBuoy, Loader2, ArrowLeft, ChevronRight, MessageCircle } from "lucide-react"
import { toast } from "sonner"
import { submitMessagesSupportTicketAction } from "@/lib/actions/messagesSupportTicket"
import { openMessagesDirectSupportConversationAction } from "@/lib/actions/openMessagesDirectSupportConversation"
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const TOPIC_KEYS = Object.keys(messagesSupportTopicLabels) as MessagesSupportTopic[]

const TOPIC_HINTS: Record<MessagesSupportTopic, string> = {
  general: "Buying, selling, fees, messages",
  account: "Profile, login, earnings & payouts",
  buying_selling: "Offers, shipping, orders, listings",
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
  const [directPending, startDirectTransition] = useTransition()

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

  function submit() {
    const userPart = resolutionNode
      ? [`What we showed them first:`, resolutionNode.resolution, "", `Their message:`, details.trim()].join(
          "\n",
        )
      : details.trim()
    const body = formatTicketDetailsWithJourney(topic, pathTitles, userPart)
    startTransition(async () => {
      const res = await submitMessagesSupportTicketAction({
        topic,
        details: body,
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

  function openDirectSupportChat() {
    startDirectTransition(async () => {
      const res = await openMessagesDirectSupportConversationAction()
      if ("error" in res && res.error) {
        if (res.error === "Unauthorized") {
          toast.error("Sign in to message someone on our team.")
          return
        }
        toast.error(res.error)
        return
      }
      if ("success" in res && res.success) {
        handleOpenChange(false)
        router.push(`/messages/${res.conversation_id}`)
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

  const topFrame = stack[stack.length - 1]
  const onTopicPick = topFrame.kind === "topics" && phase === "browse"
  const optionNodes = topFrame.kind === "options" ? topFrame.nodes : []
  const breadcrumb =
    pathTitles.length > 0 ? `${messagesSupportTopicLabels[topic]} → ${pathTitles.join(" → ")}` : null

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
        <DialogContent className="max-h-[min(92vh,680px)] gap-0 overflow-y-auto sm:max-w-md">
          <DialogHeader className="space-y-2 pb-2 text-left">
            {phase !== "browse" || !onTopicPick ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mb-1 -ml-2 h-8 w-fit gap-1 px-2 text-muted-foreground hover:text-foreground"
                onClick={goBack}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back
              </Button>
            ) : null}
            <DialogTitle className="text-xl">Contact Reswell</DialogTitle>
            <DialogDescription className="text-[15px] leading-relaxed">
              {onTopicPick
                ? "Choose a topic to see quick answers tailored to your question. You can still message our team anytime at the end."
                : phase === "freeform"
                  ? "Tell us what’s going on and we’ll follow up by email."
                  : phase === "resolution"
                    ? "Here’s something that helps most people with this."
                    : "Pick the option that best matches what you need."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {relatedConversationId ? (
              <p className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-[13px] leading-snug text-muted-foreground">
                This ticket will include a link to this chat so we can see the full context.
              </p>
            ) : null}

            {breadcrumb ? (
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {breadcrumb}
              </p>
            ) : null}

            {/* Topic grid */}
            {onTopicPick ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {TOPIC_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectTopic(key)}
                    className={cn(
                      "flex min-h-[4.25rem] flex-col items-start gap-0.5 rounded-2xl border border-border/70 bg-card px-4 py-3 text-left shadow-sm transition-colors",
                      "hover:border-foreground/15 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                  >
                    <span className="text-[15px] font-semibold leading-snug text-foreground">
                      {messagesSupportTopicLabels[key]}
                    </span>
                    <span className="text-[13px] leading-snug text-muted-foreground">{TOPIC_HINTS[key]}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {/* Journey options */}
            {topFrame.kind === "options" && phase === "browse" ? (
              <div className="space-y-2">
                <Label className="text-[13px] text-muted-foreground">What matches best?</Label>
                <ul className="space-y-2" role="list">
                  {optionNodes.map((node) => (
                    <li key={node.id}>
                      <button
                        type="button"
                        onClick={() => pickNode(node)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 text-left shadow-sm transition-colors",
                          "hover:border-foreground/15 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-semibold leading-snug text-foreground">
                            {node.title}
                          </span>
                          {node.hint ? (
                            <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
                              {node.hint}
                            </span>
                          ) : null}
                        </span>
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Resolution */}
            {phase === "resolution" && resolutionNode ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border/60 bg-muted/25 px-4 py-3">
                  <p className="text-[15px] leading-relaxed text-foreground">{resolutionNode.resolution}</p>
                  {resolutionNode.helpHref ? (
                    <Button variant="link" className="mt-2 h-auto px-0 text-primary" asChild>
                      <Link href={resolutionNode.helpHref}>
                        {resolutionNode.helpLinkLabel ?? "Learn more"}
                      </Link>
                    </Button>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
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
              <div className="space-y-2">
                {resolutionNode ? (
                  <p className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2 text-[13px] leading-snug text-muted-foreground">
                    We’ll share your note with our team along with the help snippet above.
                  </p>
                ) : null}
                <Label htmlFor="support-details">Your message</Label>
                <Textarea
                  id="support-details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Add order numbers, listing links, what you expected, and what happened instead. The more detail, the faster we can help."
                  rows={6}
                  className="min-h-[120px] resize-y text-[15px] leading-relaxed"
                  maxLength={10000}
                />
                <p className="text-[11px] text-muted-foreground">{details.trim().length} / 10000</p>
              </div>
            ) : null}
          </div>

          <DialogFooter className="gap-2 border-t border-border/60 pt-4 sm:justify-between">
            {phase === "freeform" ? (
              <>
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
              </>
            ) : phase === "resolution" ? (
              <Button type="button" variant="ghost" className="sm:ml-auto" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            ) : (
              <>
                <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={directPending}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="gap-2 rounded-full"
                  onClick={openDirectSupportChat}
                  disabled={directPending}
                >
                  {directPending ? (
                    <>
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                      Opening…
                    </>
                  ) : (
                    <>
                      <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
                      Ask someone now
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
