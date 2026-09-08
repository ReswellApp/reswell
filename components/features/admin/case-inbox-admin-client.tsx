"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Inbox, PanelRight, RefreshCw } from "lucide-react"
import type { OrderSupportOutcome } from "@/lib/db/order-support"
import type { SupportCaseStatus } from "@/lib/types/supportCase"
import { listAdminSupportInboxAction } from "@/lib/actions/adminSupportInbox"
import { sendSupportCaseAdminReplyAction } from "@/lib/actions/supportCaseThread"
import { getSupportCaseThreadAdminAction } from "@/lib/actions/supportCaseThread"
import { listSupportStaffAction } from "@/lib/actions/supportCaseAssign"
import { updateSupportCaseInboxAction } from "@/lib/actions/supportCaseInbox"
import {
  filterInboxItems,
  inboxViewFromSearchParams,
  viewToFilters,
  withInboxStatus,
  type CaseInboxItem,
  type CaseInboxTypeFilter,
  type CaseInboxView,
} from "@/lib/admin/case-inbox"
import type { SupportCaseThreadMessage } from "@/lib/services/supportCaseThread"
import type { StaffAssigneeRow } from "@/lib/db/searchInsightActions"
import type { AdminOrderDetail } from "@/lib/db/adminOrders"
import { CaseInboxViews, type InboxViewCounts } from "@/components/features/admin/case-inbox-views"
import { CaseInboxListPane } from "@/components/features/admin/case-inbox-list-pane"
import { CaseInboxConversation } from "@/components/features/admin/case-inbox-conversation"
import { CaseInboxDetails } from "@/components/features/admin/case-inbox-details"
import type { CaseInboxComposerHandle, ComposerMode } from "@/components/features/admin/case-inbox-composer"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

/** Deep link for order-type filter (legacy tab redirects land here). */
export const ADMIN_SUPPORT_INBOX_ORDER_SUPPORT_HREF = "/admin/contact-messages?type=order"

export function CaseInboxAdminClient() {
  const pathname = usePathname() ?? "/admin/contact-messages"
  const router = useRouter()
  const searchParams = useSearchParams()

  const parsed = inboxViewFromSearchParams({
    view: searchParams.get("view"),
    status: searchParams.get("status"),
    type: searchParams.get("type"),
    assignee: searchParams.get("assignee"),
    tab: searchParams.get("tab"),
  })

  const [items, setItems] = useState<CaseInboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState("")
  const [view, setView] = useState<CaseInboxView>(parsed.view)
  const [typeOverlay, setTypeOverlay] = useState<CaseInboxTypeFilter>(parsed.typeOverlay)
  const [selectedKey, setSelectedKey] = useState<string | null>(searchParams.get("case"))
  const [staff, setStaff] = useState<StaffAssigneeRow[]>([])
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const [osOutcome, setOsOutcome] = useState("none")
  const [pinnedNote, setPinnedNote] = useState("")
  const [savedNote, setSavedNote] = useState("")
  const [orderContext, setOrderContext] = useState<AdminOrderDetail | null>(null)
  const [threadReloadToken, setThreadReloadToken] = useState(0)
  const [threadMessages, setThreadMessages] = useState<SupportCaseThreadMessage[]>([])
  const [threadCaseId, setThreadCaseId] = useState<string | null>(null)
  const [composerMode, setComposerMode] = useState<ComposerMode>("reply")
  const [draft, setDraft] = useState("")

  const [savePending, startSave] = useTransition()
  const [replyPending, startReply] = useTransition()
  const composerRef = useRef<CaseInboxComposerHandle>(null)
  const skipNoteBlur = useRef(false)

  const onOrderContextLoaded = useCallback((detail: AdminOrderDetail) => {
    setOrderContext(detail)
  }, [])

  const syncUrl = useCallback(
    (nextView: CaseInboxView, nextType: CaseInboxTypeFilter, nextCase: string | null) => {
      const q = new URLSearchParams()
      if (nextView !== "open") q.set("view", nextView)
      if (nextType !== "all" && nextView !== "claims") q.set("type", nextType)
      if (nextCase) q.set("case", nextCase)
      const qs = q.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router],
  )

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") setRefreshing(true)
    else setLoading(true)

    const res = await listAdminSupportInboxAction()
    if ("error" in res) {
      toast.error(res.error)
      setItems([])
    } else {
      setItems(res.items)
    }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    void load("initial")
  }, [load])

  useEffect(() => {
    void listSupportStaffAction().then((res) => {
      if ("error" in res && res.error) return
      setStaff(res.rows)
      setCurrentStaffId(res.currentUserId)
      setIsAdmin(res.isAdmin === true)
    })
  }, [])

  const viewFilters = viewToFilters(view)
  const effectiveType: CaseInboxTypeFilter =
    view === "claims" ? "claims" : typeOverlay

  const filtered = useMemo(
    () =>
      filterInboxItems(items, {
        status: viewFilters.status,
        type: effectiveType,
        assignee: viewFilters.assignee,
        currentStaffId,
        search,
        overdueOnly: viewFilters.overdueOnly,
      }),
    [items, viewFilters, effectiveType, currentStaffId, search],
  )

  const selected = useMemo(
    () => filtered.find((item) => item.key === selectedKey) ?? null,
    [filtered, selectedKey],
  )

  useEffect(() => {
    if (loading) return
    if (!selectedKey && filtered.length > 0) {
      setSelectedKey(filtered[0]!.key)
      return
    }
    if (selectedKey && !filtered.some((item) => item.key === selectedKey) && filtered.length > 0) {
      setSelectedKey(filtered[0]!.key)
    }
    if (selectedKey && filtered.length === 0) {
      setSelectedKey(null)
    }
  }, [filtered, selectedKey, loading])

  useEffect(() => {
    syncUrl(view, typeOverlay, selectedKey)
  }, [view, typeOverlay, selectedKey, syncUrl])

  useEffect(() => {
    if (!selected) {
      setOrderContext(null)
      setDraft("")
      setComposerMode("reply")
      return
    }
    skipNoteBlur.current = true
    const note = selected.contact?.internal_notes ?? selected.order?.internal_notes ?? ""
    setPinnedNote(note)
    setSavedNote(note)
    setOsOutcome(selected.order?.outcome ?? "none")
    setDraft("")
    setComposerMode("reply")
    if (!selected.orderId) setOrderContext(null)
  }, [selected])

  const selectedId = selected?.id ?? null

  useEffect(() => {
    if (!selectedId) {
      setThreadMessages([])
      setThreadCaseId(null)
      return
    }
    setThreadMessages([])
    setThreadCaseId(selectedId)
    let cancelled = false
    void getSupportCaseThreadAdminAction(selectedId).then((res) => {
      if (cancelled) return
      if ("error" in res) return
      setThreadCaseId(res.case.id)
      setThreadMessages(res.messages)
    })
    return () => {
      cancelled = true
    }
  }, [selectedId, threadReloadToken])

  const counts = useMemo((): InboxViewCounts => {
    const openItems = items.filter((item) => item.isOpen)
    return {
      open: openItems.length,
      mine: openItems.filter((item) => item.assigneeAdminId === currentStaffId).length,
      unassigned: openItems.filter((item) => !item.assigneeAdminId).length,
      neu: items.filter((item) => item.isNew).length,
      claims: openItems.filter((item) => item.kind === "protection_claim").length,
      overdue: openItems.filter((item) => item.slaState === "overdue").length,
      resolved: items.filter((item) => !item.isOpen).length,
      all: items.length,
    }
  }, [items, currentStaffId])

  const staffNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const person of staff) {
      map[person.id] = (person.display_name ?? "Staff").trim() || "Staff"
    }
    return map
  }, [staff])

  function applyAssignee(key: string, assigneeAdminId: string | null) {
    setItems((prev) =>
      prev.map((item) =>
        item.key === key
          ? {
              ...item,
              assigneeAdminId,
              contact: item.contact ? { ...item.contact, assignee_admin_id: assigneeAdminId } : null,
              order: item.order ? { ...item.order, assignee_admin_id: assigneeAdminId } : null,
            }
          : item,
      ),
    )
  }

  function patchItem(key: string, patch: Partial<CaseInboxItem>) {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  }

  function nextOpenKey(fromKey: string): string | null {
    const remaining = filtered.filter((item) => item.key !== fromKey && item.isOpen)
    if (remaining.length === 0) return null
    const index = filtered.findIndex((item) => item.key === fromKey)
    if (index < 0) return remaining[0]!.key
    return remaining[Math.min(index, remaining.length - 1)]!.key
  }

  function persistInbox(patch: {
    status?: SupportCaseStatus
    notes?: string
    outcome?: string
    silent?: boolean
  }) {
    if (!selected) return
    if (patch.status === "resolved") {
      resolveSelected()
      return
    }
    const nextNotes = patch.notes ?? pinnedNote
    startSave(async () => {
      const res = await updateSupportCaseInboxAction({
        case_id: selected.id,
        status: patch.status,
        internal_notes: patch.notes !== undefined ? patch.notes : undefined,
        outcome:
          patch.outcome !== undefined
            ? patch.outcome === "none"
              ? null
              : patch.outcome
            : undefined,
      })
      if ("error" in res && res.error) {
        toast.error(res.error)
        return
      }
      const now = new Date().toISOString()
      const next = patch.status ? withInboxStatus(selected, patch.status) : selected
      patchItem(selected.key, {
        ...next,
        updatedAt: now,
        contact: next.contact
          ? { ...next.contact, internal_notes: nextNotes, updated_at: now }
          : null,
        order: next.order
          ? {
              ...next.order,
              internal_notes: nextNotes.trim() || null,
              outcome:
                patch.outcome === undefined
                  ? next.order.outcome
                  : ((patch.outcome === "none" ? null : patch.outcome) as OrderSupportOutcome | null),
              updated_at: now,
            }
          : null,
      })
      setSavedNote(nextNotes)
      if (patch.silent) return
      if (patch.status === "in_progress" && !selected.isOpen) {
        toast.success("Reopened")
      } else if (patch.status) {
        toast.success("Status updated")
      }
    })
  }

  function resolveSelected() {
    if (!selected?.isOpen) return
    const current = selected
    const advanceTo = nextOpenKey(current.key)
    const resolved = withInboxStatus(current, "resolved")
    patchItem(current.key, { ...resolved, updatedAt: new Date().toISOString() })
    setSelectedKey(advanceTo)
    startSave(async () => {
      const res = await updateSupportCaseInboxAction({
        case_id: current.id,
        status: "resolved",
      })
      if ("error" in res && res.error) {
        patchItem(current.key, current)
        setSelectedKey(current.key)
        toast.error(res.error)
        return
      }
      toast.success(
        advanceTo ? "Resolved — opened the next conversation" : "Resolved — inbox is clear",
      )
    })
  }

  function sendComposer(closeAfter: boolean) {
    if (!selected) return
    const body = draft.trim()
    if (!body) {
      toast.error("Write a message first.")
      return
    }
    startReply(async () => {
      const res = await sendSupportCaseAdminReplyAction({
        case_id: selected.id,
        content: body,
        is_internal: composerMode === "note",
      })
      if ("error" in res && res.error) {
        toast.error(res.error)
        return
      }
      toast.success(composerMode === "note" ? "Note added" : "Sent to customer")
      setDraft("")
      setThreadReloadToken((n) => n + 1)
      patchItem(selected.key, {
        preview: composerMode === "note" ? `Note: ${body}` : body,
        updatedAt: new Date().toISOString(),
      })
      if (closeAfter && composerMode === "reply") {
        resolveSelected()
      }
    })
  }

  function selectRelative(delta: number) {
    if (filtered.length === 0) return
    const index = filtered.findIndex((item) => item.key === selectedKey)
    const next = index < 0 ? 0 : Math.min(filtered.length - 1, Math.max(0, index + delta))
    setSelectedKey(filtered[next]!.key)
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const inField =
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "INPUT" ||
        target?.isContentEditable === true

      if (event.key === "?" && !inField) {
        event.preventDefault()
        setShortcutsOpen(true)
        return
      }
      if (inField) return
      if (event.key === "j") {
        event.preventDefault()
        selectRelative(1)
      } else if (event.key === "k") {
        event.preventDefault()
        selectRelative(-1)
      } else if (event.key === "e") {
        event.preventDefault()
        resolveSelected()
      } else if (event.key === "r") {
        event.preventDefault()
        setComposerMode("reply")
        composerRef.current?.focus()
      } else if (event.key === "n") {
        event.preventDefault()
        setComposerMode("note")
        composerRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const emptyLabel =
    items.length === 0 ? "No conversations yet." : "Nothing in this view."

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b border-border/60 px-3 py-2">
        <h1 className="text-sm font-semibold tracking-tight text-foreground">Inbox</h1>
        <p className="hidden text-xs tabular-nums text-muted-foreground sm:block">
          {counts.open} open
          {counts.overdue > 0 ? (
            <span className="text-destructive"> · {counts.overdue} overdue</span>
          ) : null}
        </p>
        <div className="ml-auto flex items-center gap-1">
          {selected ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 lg:hidden"
              onClick={() => setDetailsOpen((open) => !open)}
              aria-label="Toggle conversation details"
            >
              <PanelRight className="h-4 w-4" />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => void load("refresh")}
            disabled={refreshing}
            aria-label="Refresh inbox"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden h-full w-[168px] shrink-0 flex-col overflow-y-auto border-r border-border/60 xl:flex">
          <CaseInboxViews active={view} counts={counts} onChange={setView} />
        </aside>

        <section
          className={cn(
            "h-full min-h-0 flex-col overflow-hidden border-border/60 md:flex md:w-[300px] md:shrink-0 md:border-r lg:w-[320px]",
            selectedKey ? "hidden md:flex" : "flex w-full",
          )}
        >
          <div className="shrink-0 border-b border-border/40 px-2 py-2 xl:hidden">
            <CaseInboxViews compact active={view} counts={counts} onChange={setView} />
          </div>
          <CaseInboxListPane
            items={filtered}
            selectedKey={selectedKey}
            search={search}
            typeFilter={typeOverlay}
            showTypeFilter={view !== "claims"}
            loading={loading}
            emptyLabel={emptyLabel}
            onSearch={setSearch}
            onTypeFilter={setTypeOverlay}
            onSelect={setSelectedKey}
          />
        </section>

        <section
          className={cn(
            "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
            selectedKey ? "flex" : "hidden md:flex",
          )}
        >
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Inbox className="h-10 w-10 opacity-30" />
              <p className="text-sm">Select a conversation</p>
              <p className="text-xs">Press ? for keyboard shortcuts</p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <div
                className={cn(
                  "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
                  detailsOpen ? "hidden lg:flex" : "flex",
                )}
              >
                <CaseInboxConversation
                  key={selected.key}
                  item={selected}
                  messages={threadMessages}
                  threadCaseId={threadCaseId ?? selected.id}
                  staffNames={staffNames}
                  composerRef={composerRef}
                  mode={composerMode}
                  draft={draft}
                  pending={replyPending}
                  onBack={() => setSelectedKey(null)}
                  onModeChange={setComposerMode}
                  onDraftChange={setDraft}
                  onInsertMacro={(text) =>
                    setDraft((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text))
                  }
                  onSend={sendComposer}
                />
              </div>
              <div
                className={cn(
                  "h-full min-h-0 overflow-hidden",
                  detailsOpen ? "flex flex-1 lg:flex-none" : "hidden lg:flex",
                )}
              >
                <CaseInboxDetails
                  item={selected}
                  staff={staff}
                  currentStaffId={currentStaffId}
                  isAdmin={isAdmin}
                  osOutcome={osOutcome}
                  pinnedNote={pinnedNote}
                  savePending={savePending}
                  orderContext={orderContext}
                  onAssigned={(id) => applyAssignee(selected.key, id)}
                  onStatus={(status) => persistInbox({ status })}
                  onResolve={() => persistInbox({ status: "resolved" })}
                  onReopen={() => persistInbox({ status: "in_progress" })}
                  onOrderOutcome={(outcome) => {
                    setOsOutcome(outcome)
                    persistInbox({ outcome })
                  }}
                  onPinnedNote={setPinnedNote}
                  onPinnedNoteBlur={() => {
                    if (skipNoteBlur.current) {
                      skipNoteBlur.current = false
                      return
                    }
                    if (pinnedNote === savedNote || savePending) return
                    persistInbox({ notes: pinnedNote, silent: true })
                  }}
                  onOrderContextLoaded={onOrderContextLoaded}
                  onRefundComplete={() => void load("refresh")}
                />
              </div>
            </div>
          )}
        </section>
      </div>

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Inbox shortcuts</DialogTitle>
          </DialogHeader>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><kbd className="font-mono text-foreground">j</kbd> / <kbd className="font-mono text-foreground">k</kbd> — next / previous</li>
            <li><kbd className="font-mono text-foreground">e</kbd> — close conversation</li>
            <li><kbd className="font-mono text-foreground">r</kbd> — reply</li>
            <li><kbd className="font-mono text-foreground">n</kbd> — internal note</li>
            <li><kbd className="font-mono text-foreground">⌘↵</kbd> — send</li>
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** @deprecated Use CaseInboxAdminClient — kept for existing imports. */
export const ContactMessagesAdminClient = CaseInboxAdminClient
