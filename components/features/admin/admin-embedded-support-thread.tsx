"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { format, isToday, isYesterday } from "date-fns"
import { Loader2, LifeBuoy, MessageCircle, RefreshCw } from "lucide-react"
import type { AdminMarketplaceMessageListRow } from "@/lib/db/adminMarketplaceMessages"
import { AdminMarketplaceMessageBody } from "@/components/features/admin/admin-marketplace-message-body"
import {
  SupportCaseOpenedCard,
  SupportCaseStatusCard,
} from "@/components/features/support/support-case-system-card"
import { parseSupportThreadSystemMessage } from "@/lib/messages/parse-support-thread-message"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AdminEmbeddedSupportThreadProps {
  conversationId: string | null
  /** Member / buyer user id — used to align their bubbles on the left. */
  customerUserId: string | null
  customerLabel: string
  /** When set, Help-thread photos can be copied onto the protection case. */
  orderSupportRequestId?: string | null
  /** Bump after sending a reply so the list reloads. */
  reloadToken?: number
  /** Shown when no conversation is linked yet (e.g. Link thread button). */
  emptyAction?: ReactNode
  className?: string
  /** Taller pane for dedicated admin case page. */
  size?: "compact" | "tall"
}

function formatBubbleTime(dateStr: string) {
  const date = new Date(dateStr)
  if (isToday(date)) return format(date, "h:mm a")
  if (isYesterday(date)) return `Yesterday ${format(date, "h:mm a")}`
  return format(date, "MMM d, h:mm a")
}

function shouldBreakGroup(prevIso: string | null, nextIso: string): boolean {
  if (!prevIso) return true
  const prev = new Date(prevIso).getTime()
  const next = new Date(nextIso).getTime()
  return Math.abs(next - prev) > 8 * 60 * 1000
}

export function AdminEmbeddedSupportThread({
  conversationId,
  customerUserId,
  customerLabel,
  orderSupportRequestId = null,
  reloadToken = 0,
  emptyAction,
  className,
  size = "compact",
}: AdminEmbeddedSupportThreadProps) {
  const [messages, setMessages] = useState<AdminMarketplaceMessageListRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const loadMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([])
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set("conversation_id", conversationId)
      params.set("order", "asc")
      params.set("limit", "500")
      params.set("offset", "0")

      const res = await fetch(`/api/admin/marketplace-messages?${params}`)
      const body = (await res.json()) as {
        data?: AdminMarketplaceMessageListRow[]
        error?: string
      }

      if (!res.ok || !body.data) {
        setMessages([])
        setError(body.error ?? "Could not load messages")
        return
      }

      setMessages(body.data)
    } catch {
      setMessages([])
      setError("Could not load messages")
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages, reloadToken])

  useEffect(() => {
    if (messages.length === 0) return
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, reloadToken])

  if (!conversationId) {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-border/70 bg-muted/15 px-4 py-10 text-center",
          className,
        )}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
          <LifeBuoy className="h-5 w-5 text-muted-foreground" aria-hidden />
        </span>
        <div className="max-w-sm space-y-1">
          <p className="text-sm font-semibold text-foreground">No Help thread yet</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Link a thread to chat here. The customer sees the same conversation at their Support
            case URL.
          </p>
        </div>
        {emptyAction}
      </div>
    )
  }

  const paneMax =
    size === "tall" ? "max-h-[min(62vh,560px)] min-h-[320px]" : "max-h-[min(46vh,400px)] min-h-[220px]"

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-[20px] border border-border/55 bg-muted/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/50 bg-background/80 px-3.5 py-2.5 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <LifeBuoy className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">Help conversation</p>
            <p className="truncate text-[11px] text-muted-foreground">
              Customer sees this under Support · live thread
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => void loadMessages()}
          disabled={loading}
          aria-label="Refresh Help thread"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </Button>
      </div>

      <div className={cn("overflow-y-auto overscroll-contain px-3 py-3 sm:px-4", paneMax)}>
        {loading && messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-xs">Loading conversation…</p>
          </div>
        ) : error ? (
          <p className="py-10 text-center text-sm text-destructive">{error}</p>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-muted-foreground">
            <MessageCircle className="h-6 w-6 opacity-50" />
            <p className="text-xs">No messages yet. Send the first reply below.</p>
          </div>
        ) : (
          <div className="flex flex-col justify-end">
            {messages.map((m, index) => {
              const prev = index > 0 ? messages[index - 1] : null
              const separatorBefore = shouldBreakGroup(prev?.created_at ?? null, m.created_at)
              const system = parseSupportThreadSystemMessage(m.content)

              if (system?.kind === "opened") {
                return (
                  <div key={m.id} className={cn(separatorBefore ? "pt-3" : "mt-2.5")}>
                    {separatorBefore ? (
                      <div className="mb-2 flex justify-center">
                        <span className="text-[11px] font-medium tabular-nums text-muted-foreground/70">
                          {formatBubbleTime(m.created_at)}
                        </span>
                      </div>
                    ) : null}
                    <SupportCaseOpenedCard parsed={system} createdAt={m.created_at} />
                  </div>
                )
              }

              if (system?.kind === "status") {
                return (
                  <div key={m.id} className={cn(separatorBefore ? "pt-3" : "mt-2.5")}>
                    {separatorBefore ? (
                      <div className="mb-2 flex justify-center">
                        <span className="text-[11px] font-medium tabular-nums text-muted-foreground/70">
                          {formatBubbleTime(m.created_at)}
                        </span>
                      </div>
                    ) : null}
                    <SupportCaseStatusCard parsed={system} createdAt={m.created_at} />
                  </div>
                )
              }

              const isCustomer =
                customerUserId != null ? m.sender_id === customerUserId : false
              const next = index < messages.length - 1 ? messages[index + 1] : null
              const nextBreaks = next ? shouldBreakGroup(m.created_at, next.created_at) : true
              const groupedWithPrev =
                !!prev &&
                !separatorBefore &&
                prev.sender_id === m.sender_id &&
                !parseSupportThreadSystemMessage(prev.content)
              const groupedWithNext =
                !!next &&
                !nextBreaks &&
                next.sender_id === m.sender_id &&
                !parseSupportThreadSystemMessage(next.content)
              const isTail = !groupedWithNext

              return (
                <div key={m.id}>
                  {separatorBefore ? (
                    <div className="flex justify-center pb-1.5 pt-3 first:pt-1">
                      <span className="text-[11px] font-medium tabular-nums text-muted-foreground/70">
                        {formatBubbleTime(m.created_at)}
                      </span>
                    </div>
                  ) : null}
                  <div
                    className={cn(
                      "flex w-full",
                      isCustomer ? "justify-start" : "justify-end",
                      separatorBefore ? "" : groupedWithPrev ? "mt-0.5" : "mt-2.5",
                    )}
                  >
                    <div
                      title={format(new Date(m.created_at), "EEEE, MMM d • h:mm a")}
                      className={cn(
                        "max-w-[min(100%,20rem)] px-3.5 py-2 text-[15px] leading-[1.4] tracking-[-0.01em] sm:max-w-[min(100%,24rem)]",
                        isCustomer
                          ? cn(
                              "rounded-[20px] border border-border/45 bg-card text-foreground shadow-sm",
                              groupedWithPrev && "rounded-tl-[7px]",
                              isTail ? "rounded-bl-[6px]" : "rounded-bl-[7px]",
                            )
                          : cn(
                              "rounded-[20px] border border-primary/20 bg-primary/10 text-foreground shadow-sm",
                              groupedWithPrev && "rounded-tr-[7px]",
                              isTail ? "rounded-br-[6px]" : "rounded-br-[7px]",
                            ),
                      )}
                    >
                      {!groupedWithPrev ? (
                        <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                          {isCustomer
                            ? m.sender?.display_name?.trim() || customerLabel
                            : "Reswell Support"}
                        </p>
                      ) : null}
                      <AdminMarketplaceMessageBody
                        messageId={m.id}
                        metadata={m.metadata}
                        content={m.content}
                        orderSupportRequestId={orderSupportRequestId}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={endRef} />
          </div>
        )}
      </div>
    </div>
  )
}
