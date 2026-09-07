"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import {
  ArrowLeft,
  Loader2,
  MessageCircle,
  MessageSquarePlus,
  MoreVertical,
  Paperclip,
  Send,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { getAdminSession } from "@/app/actions/account"
import type { AdminConversationHeaderRow } from "@/lib/db/adminConversations"
import type { AdminMarketplaceMessageListRow } from "@/lib/db/adminMarketplaceMessages"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { AdminMarketplaceMessageBody } from "@/components/features/admin/admin-marketplace-message-body"
import {
  AdminSendUserMessageDialog,
  type AdminMessageParticipantOption,
} from "@/components/features/admin/admin-start-user-conversation-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type ThreadProps = {
  conversationId: string
}

type ThreadParty = "buyer" | "seller" | "support"

function participantLabel(header: AdminConversationHeaderRow): string {
  const b = header.buyer?.display_name?.trim() || "Buyer"
  const s = header.seller?.display_name?.trim() || "Seller"
  return `${b} · ${s}`
}

function resolveThreadParty(
  senderId: string,
  header: AdminConversationHeaderRow | null,
): ThreadParty {
  if (!header) return "support"
  if (senderId === header.buyer_id) return "buyer"
  if (senderId === header.seller_id) return "seller"
  return "support"
}

function partyRoleLabel(party: ThreadParty): string {
  if (party === "buyer") return "Buyer"
  if (party === "seller") return "Seller"
  return "Support"
}

export function AdminMarketplaceMessageThreadClient({ conversationId }: ThreadProps) {
  const [header, setHeader] = useState<AdminConversationHeaderRow | null>(null)
  const [messages, setMessages] = useState<AdminMarketplaceMessageListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [canDeleteMessages, setCanDeleteMessages] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminMarketplaceMessageListRow | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void getAdminSession().then((s) => {
      if (!cancelled) setCanDeleteMessages(s.isAdmin === true)
    })
    return () => {
      cancelled = true
    }
  }, [])
  const [replyText, setReplyText] = useState("")
  const [sendingReply, setSendingReply] = useState(false)
  const [caption, setCaption] = useState("")
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [sendUserOpen, setSendUserOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragDepthRef = useRef(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const msgParams = new URLSearchParams()
      msgParams.set("conversation_id", conversationId)
      msgParams.set("order", "asc")
      msgParams.set("limit", "500")
      msgParams.set("offset", "0")

      const [msgRes, convRes] = await Promise.all([
        fetch(`/api/admin/marketplace-messages?${msgParams}`),
        fetch(`/api/admin/conversations/${conversationId}`),
      ])

      const msgBody = (await msgRes.json()) as {
        data?: AdminMarketplaceMessageListRow[]
        error?: string
      }
      const convBody = (await convRes.json()) as {
        data?: AdminConversationHeaderRow
        error?: string
      }

      if (!convRes.ok || !convBody.data) {
        setError(convBody.error ?? "Conversation not found")
        setHeader(null)
        setMessages([])
        return
      }

      setHeader(convBody.data)

      if (!msgRes.ok || !msgBody.data) {
        setMessages([])
        if (msgBody.error) {
          setError(msgBody.error)
        }
        return
      }

      setMessages(msgBody.data)
    } catch {
      setError("Could not load thread")
      setHeader(null)
      setMessages([])
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    void load()
  }, [load])

  const sendReply = useCallback(async () => {
    const body = replyText.trim()
    if (!body) {
      toast.error("Enter a message")
      return
    }
    setSendingReply(true)
    try {
      const res = await fetch(`/api/admin/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: body }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(typeof json.error === "string" ? json.error : "Could not send message")
        return
      }
      setReplyText("")
      toast.success("Message sent to buyer and seller")
      await load()
    } catch {
      toast.error("Could not send message")
    } finally {
      setSendingReply(false)
    }
  }, [conversationId, load, replyText])

  const sendPdf = useCallback(
    async (file: File) => {
      if (file.type !== "application/pdf") {
        toast.error("Only PDF files can be attached")
        return
      }
      setUploading(true)
      try {
        const fd = new FormData()
        fd.append("file", file)
        const c = caption.trim()
        if (c) fd.append("caption", c)

        const res = await fetch(`/api/admin/conversations/${conversationId}/messages/pdf`, {
          method: "POST",
          body: fd,
        })
        const body = (await res.json()) as { error?: string }
        if (!res.ok) {
          toast.error(typeof body.error === "string" ? body.error : "Could not send PDF")
          return
        }
        setCaption("")
        toast.success("PDF sent")
        await load()
      } catch {
        toast.error("Could not send PDF")
      } finally {
        setUploading(false)
      }
    },
    [caption, conversationId, load],
  )

  const confirmDeleteMessage = async () => {
    if (!deleteTarget) return
    setDeleteBusy(true)
    try {
      const res = await fetch(
        `/api/admin/marketplace-messages/${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE" },
      )
      const body = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !body.success) {
        toast.error(typeof body.error === "string" ? body.error : "Could not delete message")
        return
      }
      const removedId = deleteTarget.id
      setDeleteTarget(null)
      setMessages((prev) => prev.filter((m) => m.id !== removedId))
      toast.success("Message removed for everyone")
    } catch {
      toast.error("Could not delete message")
    } finally {
      setDeleteBusy(false)
    }
  }

  const sendParticipants: { buyer: AdminMessageParticipantOption; seller: AdminMessageParticipantOption } | null =
    header
      ? {
          buyer: {
            id: header.buyer_id,
            display_name: header.buyer?.display_name ?? null,
            email: null,
            avatar_url: null,
            roleLabel: "Buyer",
          },
          seller: {
            id: header.seller_id,
            display_name: header.seller?.display_name ?? null,
            email: null,
            avatar_url: null,
            roleLabel: "Seller",
          },
        }
      : null

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
        <p className="text-sm">Loading thread…</p>
      </div>
    )
  }

  if (error && !header) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="gap-1 pl-0">
          <Link href="/admin/messages">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            All messages
          </Link>
        </Button>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 w-fit gap-1 pl-0">
            <Link href="/admin/messages">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              All messages
            </Link>
          </Button>
          {header ? (
            <div>
              <h1 className="text-2xl font-bold text-foreground">Conversation</h1>
              <p className="text-muted-foreground">{participantLabel(header)}</p>
              {header.listing?.title ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Listing: <span className="text-foreground">{header.listing.title}</span>
                </p>
              ) : null}
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                conversation_id: {header.id}
              </p>
            </div>
          ) : null}
        </div>
        {sendParticipants ? (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" aria-label="Conversation actions">
                  <MoreVertical className="h-4 w-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => setSendUserOpen(true)}>
                  <MessageSquarePlus className="mr-2 h-4 w-4" aria-hidden />
                  Send user a message
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <AdminSendUserMessageDialog
              open={sendUserOpen}
              onOpenChange={setSendUserOpen}
              participants={sendParticipants}
              trigger={null}
            />
          </>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div
        className="relative"
        onDragEnter={(e) => {
          e.preventDefault()
          e.stopPropagation()
          dragDepthRef.current += 1
          setDragActive(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          e.dataTransfer.dropEffect = "copy"
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          e.stopPropagation()
          dragDepthRef.current -= 1
          if (dragDepthRef.current <= 0) {
            dragDepthRef.current = 0
            setDragActive(false)
          }
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          dragDepthRef.current = 0
          setDragActive(false)
          const f = e.dataTransfer.files?.[0]
          if (f) void sendPdf(f)
        }}
      >
        {dragActive ? (
          <div
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-background/90 text-center backdrop-blur-sm"
            aria-hidden
          >
            <p className="text-sm font-medium text-foreground">Drop PDF to attach</p>
          </div>
        ) : null}

        {messages.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <MessageCircle className="h-8 w-8" aria-hidden />
              <p className="text-sm">No messages in this thread yet.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-sky-500" aria-hidden />
                  Buyer (left)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                  Seller (right)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                  Support
                </span>
              </div>
              {messages.map((m) => {
                const party = resolveThreadParty(m.sender_id, header)
                const align =
                  party === "buyer" ? "items-start" : party === "seller" ? "items-end" : "items-center"
                const bubbleTone =
                  party === "buyer"
                    ? "border-sky-500/25 bg-sky-500/[0.06]"
                    : party === "seller"
                      ? "border-emerald-500/25 bg-emerald-500/[0.06]"
                      : "border-amber-500/30 bg-amber-500/[0.08]"

                return (
                  <div key={m.id} className={cn("flex w-full flex-col gap-1.5", align)}>
                    <div
                      className={cn(
                        "flex max-w-[min(100%,36rem)] flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-muted-foreground",
                        party === "seller" && "flex-row-reverse text-right",
                        party === "support" && "justify-center",
                      )}
                    >
                      <span className="font-medium text-foreground">
                        {m.sender?.display_name?.trim() || m.sender_id.slice(0, 8)}
                      </span>
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          party === "buyer" && "bg-sky-500/15 text-sky-800 dark:text-sky-200",
                          party === "seller" && "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
                          party === "support" && "bg-amber-500/15 text-amber-900 dark:text-amber-100",
                        )}
                      >
                        {partyRoleLabel(party)}
                      </span>
                      <time dateTime={m.created_at}>
                        {format(new Date(m.created_at), "MMM d, yyyy h:mm a")}
                      </time>
                      {canDeleteMessages ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                          aria-label="Delete message"
                          onClick={() => setDeleteTarget(m)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                    <div
                      className={cn(
                        "max-w-[min(100%,36rem)] rounded-2xl border px-3.5 py-3",
                        bubbleTone,
                      )}
                    >
                      <AdminMarketplaceMessageBody
                        messageId={m.id}
                        metadata={m.metadata}
                        content={m.content}
                      />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        <div className="mt-4 space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Reply in this thread — visible to buyer and seller in their messages.
            </p>
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a message…"
              disabled={sendingReply}
              rows={3}
              className="min-h-[80px] resize-y bg-background"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  void sendReply()
                }
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="gap-2"
                disabled={sendingReply || !replyText.trim()}
                onClick={() => void sendReply()}
              >
                {sendingReply ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="h-4 w-4" aria-hidden />
                )}
                Send reply
              </Button>
              <span className="text-xs text-muted-foreground">⌘/Ctrl + Enter to send</span>
            </div>
          </div>

          <div className="border-t border-border/60 pt-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Send a PDF to buyer and seller — drag a file here or choose one. Optional note applies to
            the same message.
          </p>
          <Input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Optional note (shown with the PDF)"
            disabled={uploading}
            className="bg-background"
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void sendPdf(f)
                e.target.value = ""
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Paperclip className="h-4 w-4" aria-hidden />
              )}
              Choose PDF
            </Button>
            <span className="text-xs text-muted-foreground">or drag onto the thread above</span>
          </div>
          </div>
        </div>
      </div>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleteBusy) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words">
              This removes the message from the thread for the buyer, seller, and support. It cannot be
              undone.
              {deleteTarget ? (
                <>
                  <span className="mt-2 block text-xs text-muted-foreground">Preview:</span>
                  <span className="mt-1 block rounded-md border border-border/60 bg-muted/40 p-2 text-xs text-foreground">
                    {deleteTarget.content.length > 400
                      ? `${deleteTarget.content.slice(0, 400)}…`
                      : deleteTarget.content}
                  </span>
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteBusy}
              onClick={() => void confirmDeleteMessage()}
            >
              {deleteBusy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Deleting…
                </>
              ) : (
                "Delete for everyone"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
