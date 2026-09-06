"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ChevronRight,
  LifeBuoy,
  Loader2,
  MessageCircle,
  Package,
  ShieldAlert,
} from "lucide-react"
import { toast } from "sonner"
import { submitMessagesSupportTicketAction } from "@/lib/actions/messagesSupportTicket"
import {
  HELP_HUB_INTENTS,
  type HelpHubIntent,
} from "@/lib/help/help-hub-intents"
import {
  contextualOrderHelpIssues,
  helpHubOrderStatusLine,
  orderHelpFormCopy,
  orderHelpIssuePrompt,
} from "@/lib/help/order-help-issues"
import {
  formatTicketDetailsWithJourney,
  journeyNodeShowsResolution,
  journeyOptionsForTopic,
  type SupportJourneyNode,
} from "@/lib/messages/support-journey-config"
import type { HelpHubOrderOption } from "@/lib/services/supportCases"
import type { HelpHubIntentId, OrderHelpIssueId } from "@/lib/types/supportCase"
import {
  messagesSupportTopicLabels,
  type MessagesSupportTopic,
} from "@/lib/validations/messagesSupportTicket"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { ClaimEvidenceUploader } from "@/components/features/support/claim-evidence-uploader"
import type { SupportCaseAttachmentInput } from "@/lib/validations/support-case-attachment"
import { cn } from "@/lib/utils"

type Phase = "intents" | "order_pick" | "order_issue" | "order_form" | "topic_browse" | "resolution" | "freeform"

type JourneyStackFrame =
  | { kind: "options"; topic: MessagesSupportTopic; nodes: SupportJourneyNode[] }

interface HelpHubClientProps {
  orders: HelpHubOrderOption[]
  userId: string
  initialIntent?: HelpHubIntentId | null
  initialOrderId?: string | null
  initialIssue?: OrderHelpIssueId | null
  initialRole?: "buyer" | "seller" | null
  relatedConversationId?: string | null
}

export function HelpHubClient({
  orders,
  userId,
  initialIntent = null,
  initialOrderId = null,
  initialIssue = null,
  initialRole = null,
  relatedConversationId = null,
}: HelpHubClientProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const initialOrder = useMemo(
    () => (initialOrderId ? orders.find((o) => o.id === initialOrderId) ?? null : null),
    [orders, initialOrderId],
  )

  const [phase, setPhase] = useState<Phase>(() => {
    if (initialIntent === "order" || initialOrderId) {
      if (initialOrder && initialIssue) {
        const allowed = contextualOrderHelpIssues(initialOrder).some((i) => i.id === initialIssue)
        return allowed ? "order_form" : "order_issue"
      }
      if (initialOrder) return "order_issue"
      return "order_pick"
    }
    if (initialIntent) return "topic_browse"
    return "intents"
  })

  const [intent, setIntent] = useState<HelpHubIntent | null>(() => {
    if (!initialIntent) return null
    return HELP_HUB_INTENTS.find((i) => i.id === initialIntent) ?? null
  })

  const [selectedOrder, setSelectedOrder] = useState<HelpHubOrderOption | null>(initialOrder)
  const [issueId, setIssueId] = useState<OrderHelpIssueId | null>(() => {
    if (!initialOrder || !initialIssue) return initialIssue
    const allowed = contextualOrderHelpIssues(initialOrder).some((i) => i.id === initialIssue)
    return allowed ? initialIssue : null
  })
  const [roleFilter, setRoleFilter] = useState<"all" | "buyer" | "seller">(
    initialRole ?? "all",
  )

  const [topic, setTopic] = useState<MessagesSupportTopic>(
    () => intent?.topic ?? "general",
  )
  const [stack, setStack] = useState<JourneyStackFrame[]>(() => {
    const t = intent?.topic
    if (t) return [{ kind: "options", topic: t, nodes: journeyOptionsForTopic(t) }]
    return []
  })
  const [pathTitles, setPathTitles] = useState<string[]>([])
  const [resolutionNode, setResolutionNode] = useState<SupportJourneyNode | null>(null)
  const [details, setDetails] = useState("")
  const [contactedSeller, setContactedSeller] = useState<string>("")
  const [claimEvidence, setClaimEvidence] = useState<SupportCaseAttachmentInput[]>([])

  const visibleIssues = useMemo(
    () => (selectedOrder ? contextualOrderHelpIssues(selectedOrder) : []),
    [selectedOrder],
  )
  const issue = visibleIssues.find((i) => i.id === issueId) ?? null
  const formCopy =
    selectedOrder && issue ? orderHelpFormCopy(selectedOrder, issue) : null

  const filteredOrders = useMemo(() => {
    if (roleFilter === "all") return orders
    return orders.filter((o) => o.role === roleFilter)
  }, [orders, roleFilter])

  function resetToIntents() {
    setPhase("intents")
    setIntent(null)
    setSelectedOrder(null)
    setIssueId(null)
    setStack([])
    setPathTitles([])
    setResolutionNode(null)
    setDetails("")
    setContactedSeller("")
    setClaimEvidence([])
  }

  function pickIntent(next: HelpHubIntent) {
    setIntent(next)
    setPathTitles([])
    setResolutionNode(null)
    setDetails("")
    if (next.id === "order") {
      setPhase("order_pick")
      return
    }
    if (next.topic) {
      setTopic(next.topic)
      setStack([{ kind: "options", topic: next.topic, nodes: journeyOptionsForTopic(next.topic) }])
      setPhase("topic_browse")
    }
  }

  function pickOrder(order: HelpHubOrderOption) {
    setSelectedOrder(order)
    setIssueId(null)
    setDetails("")
    setContactedSeller("")
    setClaimEvidence([])
    setPhase("order_issue")
  }

  function pickIssue(id: OrderHelpIssueId) {
    setIssueId(id)
    setPhase("order_form")
  }

  function pickNode(node: SupportJourneyNode) {
    const frame = stack[stack.length - 1]
    if (!frame) return
    if (node.choices?.length) {
      setStack((s) => [...s, { kind: "options", topic: frame.topic, nodes: node.choices! }])
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
    if (phase === "freeform") {
      if (resolutionNode) {
        setPhase("resolution")
        return
      }
      if (intent?.id === "order") {
        setPhase("order_form")
        return
      }
      setPhase("topic_browse")
      setPathTitles((p) => p.slice(0, -1))
      return
    }
    if (phase === "resolution") {
      setResolutionNode(null)
      setPhase("topic_browse")
      setPathTitles((p) => p.slice(0, -1))
      return
    }
    if (phase === "order_form") {
      setIssueId(null)
      setPhase("order_issue")
      return
    }
    if (phase === "order_issue") {
      setSelectedOrder(null)
      setPhase("order_pick")
      return
    }
    if (phase === "order_pick" || phase === "topic_browse") {
      if (phase === "topic_browse" && stack.length > 1) {
        setStack((s) => s.slice(0, -1))
        setPathTitles((p) => p.slice(0, -1))
        return
      }
      resetToIntents()
      return
    }
  }

  function submitGeneralTicket() {
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
        toast.success("Case opened — you can track it under Help.")
        if (res.id) router.push(`/support/${res.id}`)
        else router.push("/dashboard/support")
      }
    })
  }

  function submitOrderHelp() {
    if (!selectedOrder || !issue || !formCopy) return
    if (issue.asksContactedSeller && contactedSeller !== "yes" && contactedSeller !== "no") {
      toast.error("Let us know whether you’ve already messaged the seller.")
      return
    }
    if (details.trim().length < 10) {
      toast.error("Please add a bit more detail (at least 10 characters).")
      return
    }

    const successMessage = formCopy.successToast
    const orderId = selectedOrder.id
    const role = selectedOrder.role
    const issueSnapshot = issue
    const bodyText = details.trim()
    const contacted = contactedSeller
    const evidence = claimEvidence

    startTransition(async () => {
      const isSeller = role === "seller"
      const endpoint = isSeller
        ? `/api/orders/${encodeURIComponent(orderId)}/seller-support`
        : `/api/orders/${encodeURIComponent(orderId)}/buyer-support`

      const payload: Record<string, unknown> = isSeller
        ? {
            request_type: issueSnapshot.id === "cancel" ? "cancel_request" : "refund_request",
            body: bodyText,
          }
        : {
            request_type: issueSnapshot.requestType,
            body: bodyText,
          }

      if (!isSeller && issueSnapshot.asksContactedSeller) {
        payload.contacted_seller_first = contacted === "yes"
      }
      if (!isSeller && issueSnapshot.id === "claim" && evidence.length > 0) {
        payload.evidence = evidence
      }

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = (await res.json()) as { error?: string; id?: string }
        if (!res.ok) {
          toast.error(data.error ?? "Could not submit request")
          return
        }
        toast.success(successMessage)
        if (data.id) router.push(`/support/${data.id}`)
        else router.push("/dashboard/support")
      } catch {
        toast.error("Something went wrong")
      }
    })
  }

  const breadcrumb =
    pathTitles.length > 0 ? `${messagesSupportTopicLabels[topic]} → ${pathTitles.join(" → ")}` : null

  const optionNodes = stack.length > 0 ? stack[stack.length - 1]!.nodes : []

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {phase !== "intents" ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 gap-1 text-muted-foreground hover:text-foreground"
          onClick={goBack}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </Button>
      ) : null}

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {phase === "intents"
            ? "How can we help?"
            : phase === "order_form" && formCopy
              ? formCopy.pageTitle
              : intent?.id === "order" && selectedOrder
                ? selectedOrder.role === "seller"
                  ? "Get help with a sale"
                  : "Get help with a purchase"
                : intent?.id === "order"
                  ? "Get help with an order"
                  : intent?.title ?? "Get help"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {phase === "intents"
            ? "Choose what you need — we’ll guide you, then open a case you can track."
            : phase === "order_pick"
              ? "Pick the purchase or sale this is about."
              : phase === "order_issue"
                ? selectedOrder
                  ? orderHelpIssuePrompt(selectedOrder)
                  : "What do you need for this order?"
                : phase === "order_form" && formCopy
                  ? formCopy.pageSubtitle
                  : phase === "resolution"
                    ? "Try this first, or message our team."
                    : phase === "freeform"
                      ? "Tell us what happened. We’ll open a case under Support."
                      : "Pick the closest match, or ask our team below."}
        </p>
      </div>

      {relatedConversationId ? (
        <p className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          This case will include a link to your marketplace conversation for context.
        </p>
      ) : null}

      {breadcrumb ? (
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {breadcrumb}
        </p>
      ) : null}

      {/* Intent picker */}
      {phase === "intents" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {HELP_HUB_INTENTS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => pickIntent(item)}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-2xl border border-border/70 bg-card px-4 py-3.5 text-left shadow-sm transition-colors",
                "hover:border-foreground/15 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                item.priority && "border-amber-500/35 bg-amber-500/[0.04]",
              )}
            >
              <span className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
                {item.id === "order" ? (
                  <Package className="h-4 w-4 text-primary" aria-hidden />
                ) : item.id === "safety" ? (
                  <ShieldAlert className="h-4 w-4 text-amber-700 dark:text-amber-300" aria-hidden />
                ) : (
                  <LifeBuoy className="h-4 w-4 text-primary" aria-hidden />
                )}
                {item.title}
              </span>
              <span className="text-[13px] leading-snug text-muted-foreground">{item.hint}</span>
            </button>
          ))}
        </div>
      ) : null}

      {/* Order picker */}
      {phase === "order_pick" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["all", "buyer", "seller"] as const).map((r) => (
              <Button
                key={r}
                type="button"
                size="sm"
                variant={roleFilter === r ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setRoleFilter(r)}
              >
                {r === "all" ? "All" : r === "buyer" ? "Purchases" : "Sales"}
              </Button>
            ))}
          </div>
          {filteredOrders.length === 0 ? (
            <div className="rounded-xl border border-dashed px-4 py-10 text-center">
              <p className="font-medium text-foreground">No orders found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                If this isn’t about an order, go back and pick another topic.
              </p>
            </div>
          ) : (
            <ul className="space-y-2" role="list">
              {filteredOrders.map((order) => (
                <li key={`${order.role}-${order.id}`}>
                  <button
                    type="button"
                    onClick={() => pickOrder(order)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 text-left shadow-sm transition-colors hover:border-foreground/15 hover:bg-muted/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-foreground">
                        {order.title}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-muted-foreground">
                        {order.role === "buyer" ? "Purchase" : "Sale"} · {order.orderRef} ·{" "}
                        {helpHubOrderStatusLine(order)}
                      </span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {/* Order issue types */}
      {phase === "order_issue" && selectedOrder ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-border/60 bg-muted/25 px-3.5 py-3">
            <p className="text-[15px] font-medium text-foreground">{selectedOrder.title}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {selectedOrder.orderRef}
              <span className="mx-1.5 text-border">·</span>
              {helpHubOrderStatusLine(selectedOrder)}
              <span className="mx-1.5 text-border">·</span>
              {selectedOrder.role === "buyer" ? "Your purchase" : "Your sale"}
            </p>
          </div>
          <ul className="space-y-2" role="list">
            {visibleIssues.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => pickIssue(item.id)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 text-left shadow-sm transition-colors hover:border-foreground/15 hover:bg-muted/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-foreground">{item.title}</span>
                    <span className="mt-0.5 block text-[13px] text-muted-foreground">{item.hint}</span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          {selectedOrder.role === "buyer" &&
          (selectedOrder.deliveryStatus === "pending" ||
            selectedOrder.deliveryStatus === "pickup_ready" ||
            selectedOrder.deliveryStatus === "shipped") ? (
            <Button variant="outline" size="sm" className="rounded-full" asChild>
              <Link href={`/dashboard/purchases/${selectedOrder.id}`}>
                <MessageCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Message the seller first
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Order form */}
      {phase === "order_form" && selectedOrder && issue && formCopy ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-muted/25 px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-foreground ring-1 ring-border/60">
                {formCopy.roleBadge}
              </span>
              <span className="text-[13px] text-muted-foreground">
                {helpHubOrderStatusLine(selectedOrder)}
              </span>
            </div>
            <p className="mt-1.5 text-[15px] font-medium text-foreground">{selectedOrder.title}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {issue.title}
              <span className="mx-1.5 text-border">·</span>
              {selectedOrder.orderRef}
            </p>
          </div>

          {formCopy.tips.length > 0 ? (
            <ul className="space-y-1 rounded-xl border border-border/50 bg-background px-3.5 py-3 text-[13px] text-muted-foreground">
              {formCopy.tips.map((tip) => (
                <li key={tip} className="leading-snug">
                  · {tip}
                </li>
              ))}
            </ul>
          ) : null}

          {issue.asksContactedSeller && selectedOrder.role === "buyer" ? (
            <div className="space-y-2">
              <Label>Have you already messaged the seller about this?</Label>
              <RadioGroup value={contactedSeller} onValueChange={setContactedSeller} className="flex gap-6">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="hub-contacted-yes" />
                  <Label htmlFor="hub-contacted-yes" className="font-normal">
                    Yes
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="hub-contacted-no" />
                  <Label htmlFor="hub-contacted-no" className="font-normal">
                    No
                  </Label>
                </div>
              </RadioGroup>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="hub-order-details">{formCopy.detailsLabel}</Label>
            <Textarea
              id="hub-order-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={5}
              placeholder={formCopy.detailsPlaceholder}
              maxLength={8000}
            />
            <p className="text-[12px] text-muted-foreground">{formCopy.detailsHint}</p>
          </div>

          {issue.id === "claim" && selectedOrder.role === "buyer" ? (
            <div className="space-y-2">
              <Label>
                {selectedOrder.deliveryStatus === "shipped"
                  ? "Photos (optional)"
                  : "Photos of damage / packing (recommended)"}
              </Label>
              <ClaimEvidenceUploader
                userId={userId}
                value={claimEvidence}
                onChange={setClaimEvidence}
              />
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {formCopy.peerMessage ? (
                <Button variant="outline" size="sm" className="rounded-full" asChild>
                  <Link href={formCopy.peerMessage.href}>
                    <MessageCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                    {formCopy.peerMessage.label}
                  </Link>
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={goBack} disabled={pending}>
                Back
              </Button>
              <Button
                type="button"
                onClick={submitOrderHelp}
                disabled={
                  pending ||
                  details.trim().length < 10 ||
                  (issue.asksContactedSeller &&
                    selectedOrder.role === "buyer" &&
                    contactedSeller !== "yes" &&
                    contactedSeller !== "no")
                }
              >
                {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {formCopy.submitLabel}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Topic journey */}
      {phase === "topic_browse" ? (
        <div className="space-y-4">
          <ul className="space-y-2" role="list">
            {optionNodes.map((node) => (
              <li key={node.id}>
                <button
                  type="button"
                  onClick={() => pickNode(node)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 text-left shadow-sm transition-colors hover:border-foreground/15 hover:bg-muted/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-foreground">{node.title}</span>
                    {node.hint ? (
                      <span className="mt-0.5 block text-[13px] text-muted-foreground">{node.hint}</span>
                    ) : null}
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            size="sm"
            className="gap-1.5 rounded-full"
            onClick={() => {
              setResolutionNode(null)
              setDetails("")
              setPhase("freeform")
            }}
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden />
            Ask someone now
          </Button>
        </div>
      ) : null}

      {phase === "resolution" && resolutionNode ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/60 bg-muted/25 px-4 py-3">
            <p className="text-[15px] leading-relaxed text-foreground">{resolutionNode.resolution}</p>
            {resolutionNode.helpHref ? (
              <Button variant="link" className="mt-2 h-auto px-0 text-sm text-primary" asChild>
                <Link href={resolutionNode.helpHref}>
                  {resolutionNode.helpLinkLabel ?? "Learn more"}
                </Link>
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => {
                toast.message("Great — glad that helped.")
                router.push("/dashboard/support")
              }}
            >
              That solved it
            </Button>
            <Button type="button" className="rounded-full" onClick={() => setPhase("freeform")}>
              I still need help
            </Button>
          </div>
        </div>
      ) : null}

      {phase === "freeform" ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hub-details">Your message</Label>
            <Textarea
              id="hub-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={5}
              placeholder="Add order numbers, listing links, what you expected, and what happened instead."
              maxLength={10000}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={goBack} disabled={pending}>
              Back
            </Button>
            <Button
              type="button"
              onClick={submitGeneralTicket}
              disabled={pending || details.trim().length < 10}
            >
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Open case
            </Button>
          </div>
        </div>
      ) : null}

      <p className="text-center text-xs text-muted-foreground">
        Prefer browsing first?{" "}
        <Link href="/help" className="text-primary underline underline-offset-2">
          Help Center
        </Link>{" "}
        ·{" "}
        <Link href="/faq" className="text-primary underline underline-offset-2">
          FAQ
        </Link>
      </p>
    </div>
  )
}
