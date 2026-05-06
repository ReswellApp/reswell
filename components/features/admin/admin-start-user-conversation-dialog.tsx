"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, MessageSquarePlus, Search } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"

export function AdminStartUserConversationDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [results, setResults] = useState<AdminMarketplaceProfilePickerRow[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<AdminMarketplaceProfilePickerRow | null>(null)
  const [initialMessage, setInitialMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 300)
    return () => window.clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (!open) return
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
  }, [debounced, open])

  const resetForm = useCallback(() => {
    setSearch("")
    setDebounced("")
    setResults([])
    setSelected(null)
    setInitialMessage("")
  }, [])

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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="default" size="sm" className="gap-2 shrink-0">
          <MessageSquarePlus className="h-4 w-4" aria-hidden />
          Message a user
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start a conversation</DialogTitle>
          <DialogDescription>
            Opens the marketplace DM thread between you and the selected member (or jumps to your
            existing thread). They will see messages in{" "}
            <span className="font-medium text-foreground">Messages</span> like any other chat.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="admin-msg-user-search">Find member</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="admin-msg-user-search"
                placeholder="Name or email (min. 2 characters)"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setSelected(null)
                }}
                className="pl-9"
                autoComplete="off"
              />
            </div>
            {selected ? (
              <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/25 px-3 py-2">
                <Avatar className="h-8 w-8 shrink-0">
                  {selected.avatar_url ? (
                    <AvatarImage src={selected.avatar_url} alt="" />
                  ) : null}
                  <AvatarFallback className="text-xs">
                    {(selected.display_name ?? selected.email ?? "?")[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
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
                  onClick={() => setSelected(null)}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border/60">
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
                  <ul className="divide-y divide-border/50">
                    {results.map((row) => (
                      <li key={row.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
                          onClick={() => setSelected(row)}
                        >
                          <Avatar className="h-8 w-8 shrink-0">
                            {row.avatar_url ? <AvatarImage src={row.avatar_url} alt="" /> : null}
                            <AvatarFallback className="text-xs">
                              {(row.display_name ?? row.email ?? "?")[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
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
            )}
          </div>
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
