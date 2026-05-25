"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Loader2, MessageSquarePlus, Search } from "lucide-react"
import { toast } from "sonner"
import type { AdminMarketplaceProfilePickerRow } from "@/lib/services/adminStartMarketplaceConversation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export type AdminMessageParticipantOption = AdminMarketplaceProfilePickerRow & {
  roleLabel: string
}

export type AdminSendUserMessageDialogProps = {
  /** When set, admin picks buyer or seller instead of searching all members. */
  participants?: {
    buyer: AdminMessageParticipantOption
    seller: AdminMessageParticipantOption
  }
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Custom trigger; pass `null` to hide the default button when using controlled open. */
  trigger?: React.ReactNode | null
}

function profileToPickerRow(
  row: AdminMarketplaceProfilePickerRow | AdminMessageParticipantOption,
): AdminMarketplaceProfilePickerRow {
  return {
    id: row.id,
    display_name: row.display_name,
    email: row.email,
    avatar_url: row.avatar_url,
  }
}

function ParticipantAvatar({ row }: { row: AdminMarketplaceProfilePickerRow }) {
  return (
    <Avatar className="h-8 w-8 shrink-0">
      {row.avatar_url ? <AvatarImage src={row.avatar_url} alt="" /> : null}
      <AvatarFallback className="text-xs">
        {(row.display_name ?? row.email ?? "?")[0]?.toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}

function SenderReceiverPreview({
  receiver,
  roleLabel,
  selected,
  onSelect,
}: {
  receiver: AdminMessageParticipantOption
  roleLabel: string
  selected: boolean
  onSelect: () => void
}) {
  const receiverName = receiver.display_name?.trim() || "Unnamed member"

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col gap-2 rounded-lg border px-3 py-3 text-left transition-colors",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border/70 bg-muted/20 hover:bg-muted/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {roleLabel}
        </span>
        {selected ? (
          <span className="text-xs font-medium text-primary">Selected</span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-foreground">You</span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <ParticipantAvatar row={receiver} />
        <span className="min-w-0 truncate font-medium text-foreground">{receiverName}</span>
      </div>
      {receiver.email ? (
        <p className="truncate text-xs text-muted-foreground">{receiver.email}</p>
      ) : null}
    </button>
  )
}

export function AdminSendUserMessageDialog({
  participants,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  trigger,
}: AdminSendUserMessageDialogProps) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = controlledOnOpenChange ?? setInternalOpen

  const [dialogSurfaceEl, setDialogSurfaceEl] = useState<HTMLElement | null>(null)
  const [memberPickerOpen, setMemberPickerOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [results, setResults] = useState<AdminMarketplaceProfilePickerRow[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<AdminMarketplaceProfilePickerRow | null>(null)
  const [initialMessage, setInitialMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const isParticipantMode = Boolean(participants)

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 300)
    return () => window.clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (!open || isParticipantMode) return
    if (debounced.length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    let cancelled = false
    setSearching(true)
    const params = new URLSearchParams()
    params.set("q", debounced)
    params.set("limit", "20")
    void fetch(`/api/admin/marketplace-conversations/user-search?${params}`)
      .then(async (res) => {
        const body = (await res.json()) as {
          data?: AdminMarketplaceProfilePickerRow[]
          error?: string
        }
        if (cancelled) return
        if (!res.ok) {
          setResults([])
          toast.error(typeof body.error === "string" ? body.error : "Search failed")
          return
        }
        setResults(body.data ?? [])
      })
      .catch(() => {
        if (!cancelled) {
          setResults([])
          toast.error("Search failed")
        }
      })
      .finally(() => {
        if (!cancelled) setSearching(false)
      })
    return () => {
      cancelled = true
    }
  }, [debounced, isParticipantMode, open])

  const resetForm = useCallback(() => {
    setSearch("")
    setDebounced("")
    setResults([])
    setSelected(null)
    setInitialMessage("")
    setMemberPickerOpen(false)
  }, [])

  useEffect(() => {
    if (!open) setMemberPickerOpen(false)
  }, [open])

  useEffect(() => {
    if (selected) setMemberPickerOpen(false)
  }, [selected])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      resetForm()
    }
  }

  const submit = async () => {
    if (!selected) {
      toast.error("Select a member")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/marketplace-conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_user_id: selected.id,
          initial_message: initialMessage.trim() || null,
        }),
      })
      const body = (await res.json()) as {
        data?: { conversation_id: string }
        error?: string
      }
      if (!res.ok || !body.data?.conversation_id) {
        toast.error(typeof body.error === "string" ? body.error : "Could not start conversation")
        return
      }
      toast.success("Opening thread…")
      setOpen(false)
      resetForm()
      router.push(`/admin/messages/${body.data.conversation_id}`)
    } catch {
      toast.error("Could not start conversation")
    } finally {
      setSubmitting(false)
    }
  }

  const defaultTrigger =
    trigger === undefined ? (
      <Button type="button" variant="default" size="sm" className="gap-2 shrink-0">
        <MessageSquarePlus className="h-4 w-4" aria-hidden />
        Message a user
      </Button>
    ) : (
      trigger
    )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {defaultTrigger !== null ? (
        <DialogTrigger asChild>{defaultTrigger}</DialogTrigger>
      ) : null}
      <DialogContent
        ref={setDialogSurfaceEl}
        className="sm:max-w-md"
        onPointerDownOutside={(e) => {
          const t = e.target as HTMLElement | null
          if (t?.closest("[data-admin-member-picker]")) {
            e.preventDefault()
          }
        }}
        onFocusOutside={(e) => {
          const t = e.target as HTMLElement | null
          if (t?.closest("[data-admin-member-picker]")) {
            e.preventDefault()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Send user a message</DialogTitle>
          <DialogDescription>
            {isParticipantMode
              ? "Choose who you want to message. Messages appear in their Messages inbox like any other chat."
              : "Opens the marketplace DM thread between you and the selected member (or jumps to your existing thread). They will see messages in Messages like any other chat."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          {isParticipantMode && participants ? (
            <div className="space-y-2">
              <Label>Choose recipient</Label>
              <div className="grid gap-2">
                <SenderReceiverPreview
                  receiver={participants.buyer}
                  roleLabel={participants.buyer.roleLabel}
                  selected={selected?.id === participants.buyer.id}
                  onSelect={() => setSelected(profileToPickerRow(participants.buyer))}
                />
                <SenderReceiverPreview
                  receiver={participants.seller}
                  roleLabel={participants.seller.roleLabel}
                  selected={selected?.id === participants.seller.id}
                  onSelect={() => setSelected(profileToPickerRow(participants.seller))}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="admin-msg-user-search">Find member</Label>
              <Popover
                open={open && !selected && memberPickerOpen}
                onOpenChange={(next) => {
                  if (!selected) setMemberPickerOpen(next)
                }}
                modal={false}
              >
                <PopoverAnchor asChild>
                  <div className="relative w-full">
                    <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="admin-msg-user-search"
                      role="combobox"
                      aria-expanded={open && !selected && memberPickerOpen}
                      aria-autocomplete="list"
                      placeholder="Name or email (min. 2 characters)"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value)
                        setSelected(null)
                        setMemberPickerOpen(true)
                      }}
                      onFocus={() => setMemberPickerOpen(true)}
                      className="pl-9"
                      autoComplete="off"
                      disabled={submitting}
                    />
                  </div>
                </PopoverAnchor>
                <PopoverContent
                  data-admin-member-picker
                  portalContainer={dialogSurfaceEl}
                  align="start"
                  sideOffset={6}
                  className="z-[100] w-[var(--radix-popover-trigger-width)] p-0 shadow-md"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <div className="max-h-[min(280px,50vh)] overflow-y-auto overscroll-contain outline-none [touch-action:pan-y]">
                    {searching ? (
                      <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Searching…
                      </div>
                    ) : debounced.length >= 2 && results.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">No members match.</p>
                    ) : debounced.length > 0 && debounced.length < 2 ? (
                      <p className="p-3 text-sm text-muted-foreground">Type at least 2 characters.</p>
                    ) : debounced.length < 2 ? (
                      <p className="p-3 text-sm text-muted-foreground">
                        Start typing a name or email to search.
                      </p>
                    ) : (
                      <ul className="divide-y divide-border/50" role="listbox">
                        {results.map((row) => (
                          <li key={row.id} role="option">
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
                              onClick={() => {
                                setSelected(row)
                                setMemberPickerOpen(false)
                              }}
                            >
                              <ParticipantAvatar row={row} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-foreground">
                                  {row.display_name?.trim() || "Unnamed member"}
                                </p>
                                {row.email ? (
                                  <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                                ) : null}
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              {selected ? (
                <div className="space-y-2">
                  <Label>Sender and receiver</Label>
                  <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/25 px-3 py-2 text-sm">
                    <span className="font-medium text-foreground">You</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <ParticipantAvatar row={selected} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {selected.display_name?.trim() || "Unnamed member"}
                      </p>
                      {selected.email ? (
                        <p className="truncate text-xs text-muted-foreground">{selected.email}</p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0"
                      onClick={() => {
                        setSelected(null)
                        setMemberPickerOpen(true)
                      }}
                    >
                      Change
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="admin-msg-initial">First message (optional)</Label>
            <Textarea
              id="admin-msg-initial"
              placeholder="Say hello or add context…"
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              rows={3}
              maxLength={8000}
              disabled={submitting}
              className="resize-none"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!selected || submitting} onClick={() => void submit()}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Starting…
              </>
            ) : (
              "Open thread"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** @deprecated Use AdminSendUserMessageDialog — kept for existing imports. */
export const AdminStartUserConversationDialog = AdminSendUserMessageDialog
