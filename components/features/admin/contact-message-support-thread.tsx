"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { format } from "date-fns"
import type { ContactMessageRow } from "@/lib/db/contactMessages"
import type { AdminMarketplaceMessageListRow } from "@/lib/db/adminMarketplaceMessages"
import {
  ensureSupportTicketThreadAdminAction,
  sendSupportTicketAdminReplyAction,
  updateContactMessageAdminAction,
} from "@/lib/actions/contactMessagesAdmin"
import {
  CHANNEL_LABEL,
  STATUS_LABEL,
  STATUS_LIST,
  channelBadgeVariant,
  statusBadgeVariant,
} from "@/components/features/admin/contact-messages-labels"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { ContactMessageSupportStatus } from "@/lib/db/contactMessages"

interface ContactMessageSupportThreadProps {
  initialTicket: ContactMessageRow
  supportUserId: string | null
}

export function ContactMessageSupportThread({
  initialTicket,
  supportUserId,
}: ContactMessageSupportThreadProps) {
  const [ticket, setTicket] = useState(initialTicket)
  const [messages, setMessages] = useState<AdminMarketplaceMessageListRow[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [messagesError, setMessagesError] = useState<string | null>(null)
  const [draftReply, setDraftReply] = useState("")
  const [draftStatus, setDraftStatus] = useState<ContactMessageSupportStatus>(ticket.support_status)
  const [draftNotes, setDraftNotes] = useState(ticket.internal_notes ?? "")
  const [replyPending, startReplyTransition] = useTransition()
  const [threadPending, startThreadTransition] = useTransition()
  const [savePending, startSaveTransition] = useTransition()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadMessages = useCallback(async (conversationIdOverride?: string) => {
    const conversationId = conversationIdOverride ?? ticket.support_conversation_id
    if (!conversationId) {
      setMessages([])
      setMessagesError(null)
      return
    }

    setLoadingMessages(true)
    setMessagesError(null)
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
        setMessagesError(body.error ?? "Could not load messages")
        return
      }

      setMessages(body.data)
    } catch {
      setMessages([])
      setMessagesError("Could not load messages")
    } finally {
      setLoadingMessages(false)
    }
  }, [ticket.support_conversation_id])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  function openSupportThread() {
    startThreadTransition(async () => {
      const res = await ensureSupportTicketThreadAdminAction({ ticket_id: ticket.id })
      if ("error" in res && res.error) {
        toast.error(res.error)
        return
      }
      if (!("support_conversation_id" in res) || !res.support_conversation_id) {
        toast.error("Could not link support thread.")
        return
      }
      toast.success("Support thread linked — the member can reply in Dashboard → Support.")
      const now = new Date().toISOString()
      const conversationId = res.support_conversation_id
      setTicket((prev) => ({
        ...prev,
        support_conversation_id: conversationId,
        updated_at: now,
      }))
      await loadMessages(conversationId)
    })
  }

  function sendReply() {
    const body = draftReply.trim()
    if (!body) {
      toast.error("Write a message first.")
      return
    }

    startReplyTransition(async () => {
      const res = await sendSupportTicketAdminReplyAction({
        ticket_id: ticket.id,
        content: body,
      })
      if ("error" in res && res.error) {
        toast.error(res.error)
        return
      }
      if (!("support_conversation_id" in res) || !res.support_conversation_id) {
        toast.error("Could not send message.")
        return
      }
      toast.success("Message sent — visible in the member’s Dashboard → Support.")
      const now = new Date().toISOString()
      const conversationId = res.support_conversation_id
      setTicket((prev) => ({
        ...prev,
        support_conversation_id: conversationId,
        updated_at: now,
      }))
      setDraftReply("")
      await loadMessages(conversationId)
    })
  }

  function saveWorkflow() {
    startSaveTransition(async () => {
      const res = await updateContactMessageAdminAction({
        id: ticket.id,
        support_status: draftStatus,
        internal_notes: draftNotes,
      })
      if ("error" in res && res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Saved")
      const now = new Date().toISOString()
      setTicket((prev) => ({
        ...prev,
        support_status: draftStatus,
        internal_notes: draftNotes,
        updated_at: now,
      }))
    })
  }

  const memberDashboardHref = `/dashboard/support/${ticket.id}`

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Button variant="ghost" size="sm" asChild className="-ml-2 gap-1.5 text-muted-foreground">
            <Link href="/admin/contact-messages">
              <ArrowLeft className="h-4 w-4" />
              Support inbox
            </Link>
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={channelBadgeVariant(ticket.source)} className="font-medium">
              {CHANNEL_LABEL[ticket.source]}
            </Badge>
            <Badge variant={statusBadgeVariant(ticket.support_status)} className="font-medium">
              {STATUS_LABEL[ticket.support_status]}
            </Badge>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {ticket.subject?.trim() || "Support request"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {ticket.name} ·{" "}
              <a href={`mailto:${ticket.email}`} className="text-primary hover:underline">
                {ticket.email}
              </a>
            </p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">Ticket · {ticket.id}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {ticket.user_id ? (
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <Link href={`/admin/users/${ticket.user_id}`}>
                <ExternalLink className="h-4 w-4" />
                Member in admin
              </Link>
            </Button>
          ) : null}
          {ticket.user_id ? (
            <Button variant="secondary" size="sm" className="gap-1.5" asChild>
              <Link href={memberDashboardHref} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Member support view
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
        <div className="space-y-4">
          <Card className="overflow-hidden border-border/80">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Support conversation</p>
                <p className="text-xs text-muted-foreground">
                  Replies post as your configured support teammate. The member sees them in{" "}
                  <strong>Dashboard → Support</strong>.
                </p>
              </div>
              {ticket.support_conversation_id ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => void loadMessages()}
                  disabled={loadingMessages}
                  aria-label="Refresh messages"
                >
                  <RefreshCw className={cn("h-4 w-4", loadingMessages && "animate-spin")} />
                </Button>
              ) : null}
            </div>

            {!ticket.user_id ? (
              <CardContent className="px-4 py-8 text-center text-sm text-muted-foreground">
                This visitor has no linked member account. An hourly job links tickets when the email
                matches an account — then you can open a support thread here.
              </CardContent>
            ) : !ticket.support_conversation_id ? (
              <CardContent className="flex flex-col items-center gap-4 px-6 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <MessageCircle className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="max-w-md space-y-2">
                  <p className="text-base font-medium text-foreground">No thread linked yet</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Open a support thread to start chatting. The member will see it at{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{memberDashboardHref}</code>.
                  </p>
                </div>
                <Button
                  type="button"
                  className="gap-1.5 rounded-full"
                  onClick={openSupportThread}
                  disabled={threadPending}
                >
                  {threadPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Linking…
                    </>
                  ) : (
                    <>
                      <MessageCircle className="h-4 w-4" />
                      Open support thread
                    </>
                  )}
                </Button>
              </CardContent>
            ) : (
              <>
                <div className="max-h-[min(60vh,560px)] overflow-y-auto px-4 py-4">
                  {loadingMessages && messages.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <p className="text-sm">Loading messages…</p>
                    </div>
                  ) : messagesError ? (
                    <p className="py-8 text-center text-sm text-destructive">{messagesError}</p>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                      <MessageCircle className="h-8 w-8 opacity-50" />
                      <p className="text-sm">No messages yet. Send the first reply below.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {messages.map((m) => {
                        const isSupport =
                          supportUserId != null && m.sender_id === supportUserId
                        return (
                          <div
                            key={m.id}
                            className={cn(
                              "max-w-[92%] rounded-2xl border px-3.5 py-2.5 text-sm shadow-sm",
                              isSupport
                                ? "ml-auto border-primary/20 bg-primary/5"
                                : "mr-auto border-border/70 bg-muted/30",
                            )}
                          >
                            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">
                                {isSupport
                                  ? "Reswell Support"
                                  : m.sender?.display_name?.trim() || ticket.name}
                              </span>
                              <time dateTime={m.created_at}>
                                {format(new Date(m.created_at), "MMM d, h:mm a")}
                              </time>
                            </div>
                            <p className="whitespace-pre-wrap leading-relaxed text-foreground">
                              {m.content}
                            </p>
                          </div>
                        )
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                <div className="border-t border-border/60 bg-muted/10 px-4 py-4">
                  <Label htmlFor="support-thread-reply" className="sr-only">
                    Reply to member
                  </Label>
                  <Textarea
                    id="support-thread-reply"
                    value={draftReply}
                    onChange={(e) => setDraftReply(e.target.value)}
                    placeholder="Write a message the member will see in Dashboard → Support…"
                    rows={3}
                    className="min-h-[88px] resize-y rounded-xl bg-background text-[15px]"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="gap-1.5 rounded-full"
                      onClick={sendReply}
                      disabled={replyPending || threadPending || !draftReply.trim()}
                    >
                      {replyPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending…
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Send to member
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="rounded-xl border-border/80">
            <CardContent className="space-y-4 p-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Original request
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {ticket.message}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Received {format(new Date(ticket.created_at), "PPpp")}
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="ticket-status" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Workflow
                </Label>
                <Select
                  value={draftStatus}
                  onValueChange={(v) => setDraftStatus(v as ContactMessageSupportStatus)}
                >
                  <SelectTrigger id="ticket-status" className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_LIST.map((k) => (
                      <SelectItem key={k} value={k}>
                        {STATUS_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ticket-notes" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Internal notes
                </Label>
                <Textarea
                  id="ticket-notes"
                  value={draftNotes}
                  onChange={(e) => setDraftNotes(e.target.value)}
                  placeholder="Team-only context"
                  rows={4}
                  className="min-h-[100px] resize-y rounded-xl text-[15px]"
                />
              </div>

              <Button
                type="button"
                className="w-full rounded-full"
                onClick={saveWorkflow}
                disabled={savePending}
              >
                {savePending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save workflow"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
