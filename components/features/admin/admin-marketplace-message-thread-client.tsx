"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ArrowLeft, Loader2, MessageCircle, MessageSquarePlus, MoreVertical, Paperclip, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { getAdminSession } from "@/app/actions/account"
import type { AdminConversationHeaderRow } from "@/lib/db/adminConversations"
import type { AdminMarketplaceMessageListRow } from "@/lib/db/adminMarketplaceMessages"
import { parseMarketplaceMessagePdfAttachment } from "@/lib/validations/marketplace-message-attachment"
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
import { OpenMarketplacePdfButton } from "@/components/features/messages/open-marketplace-pdf-button"
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

type ThreadProps = {
  conversationId: string
}

function participantLabel(header: AdminConversationHeaderRow): string {
  const b = header.buyer?.display_name?.trim() || "Buyer"
  const s = header.seller?.display_name?.trim() || "Seller"
  return `${b} · ${s}`
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
            <CardContent className="flex flex-col gap-3 p-4">
              {messages.map((m) => {
                const pdfAtt = parseMarketplaceMessagePdfAttachment(m.metadata)
                const redundantCaption =
                  pdfAtt && m.content.trim() === `Attachment: ${pdfAtt.file_name}`

                return (
                  <div
                    key={m.id}
                    className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/40 pb-1.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {m.sender?.display_name?.trim() || m.sender_id.slice(0, 8)}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
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
                    </div>
                    <div className="mt-2 space-y-2">
                      {pdfAtt ? (
                        <OpenMarketplacePdfButton messageId={m.id} fileName={pdfAtt.file_name} />
                      ) : null}
                      {!redundantCaption && m.content?.trim() ? (
                        <p className="whitespace-pre-wrap break-words text-foreground">{m.content}</p>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        <div className="mt-4 space-y-2 rounded-xl border border-border/60 bg-muted/20 p-4">
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
