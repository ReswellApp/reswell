"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Inbox, PanelRight, RefreshCw } from "lucide-react"
import type { OrderSupportOutcome } from "@/lib/db/order-support"
import type { SupportCaseEventRow } from "@/lib/db/supportCases"
import type { SupportCaseStatus } from "@/lib/types/supportCase"
import {
  listAdminSupportInboxAction,
} from "@/lib/actions/adminSupportInbox"
import type { AdminSupportInboxResult } from "@/lib/services/adminSupportInbox"
import { sendSupportCaseAdminReplyAction } from "@/lib/actions/supportCaseThread"
import { getSupportCaseThreadAdminAction } from "@/lib/actions/supportCaseThread"
import {
  assignSupportCaseAction,
  listSupportStaffAction,
} from "@/lib/actions/supportCaseAssign"
import { updateSupportCaseInboxAction } from "@/lib/actions/supportCaseInbox"
import {
  DEFAULT_INBOX_SORT,
  filterInboxItems,
  findInboxItemBySelection,
  inboxLoadQueryKey,
  inboxViewFromSearchParams,
  mergeInboxPageItems,
  nextInboxSelectedKey,
  pinSelectedInboxItem,
  shouldApplyInboxLoad,
  sortInboxItems,
  viewToFilters,
  withInboxStatus,
  type CaseInboxItem,
  type CaseInboxPriority,
  type CaseInboxSort,
  type CaseInboxTypeFilter,
  type CaseInboxView,
  type InboxViewCounts,
  EMPTY_INBOX_VIEW_COUNTS,
} from "@/lib/admin/case-inbox"
import { staffSentToast } from "@/lib/admin/case-inbox-counterpart"
import type { SupportCaseThreadMessage } from "@/lib/services/supportCaseThread"
import type { StaffAssigneeRow } from "@/lib/db/searchInsightActions"
import type { AdminOrderDetail } from "@/lib/db/adminOrders"
import type { CaseOrderLabelContext } from "@/lib/admin/admin-order-capabilities"
import { AdminCreateSupportCaseDialog } from "@/components/features/admin/admin-create-support-case-dialog"
import { CaseInboxViews } from "@/components/features/admin/case-inbox-views"
import { CaseInboxListPane } from "@/components/features/admin/case-inbox-list-pane"
import { CaseInboxConversation } from "@/components/features/admin/case-inbox-conversation"
import { CaseInboxDetails } from "@/components/features/admin/case-inbox-details"
import type {
  CaseInboxComposerHandle,
  ComposerDisposition,
  ComposerMode,
} from "@/components/features/admin/case-inbox-composer"
import type { SupportCaseCustomerContext } from "@/lib/services/supportCaseCustomerContext"
import { useSupportReplyDraft } from "@/components/features/admin/hooks/use-support-reply-draft"
import {
  inboxSuggestionBelongsToSelectedCase,
  parseStoredCaseComposerDraft,
  serializeStoredCaseComposerDraft,
  shouldApplyInboxSuggestion,
} from "@/lib/admin/case-inbox-draft"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { inboxCaseKey } from "@/lib/utils/support-case-paths"
import { cn } from "@/lib/utils"

/** Deep link for order-type filter (legacy tab redirects land here). */
export const ADMIN_SUPPORT_INBOX_ORDER_SUPPORT_HREF = "/admin/contact-messages?type=order"

const CASE_DRAFT_STORAGE_PREFIX = "reswell:support-draft:v1:"

function readCaseDraft(caseId: string) {
  return parseStoredCaseComposerDraft(
    window.sessionStorage.getItem(`${CASE_DRAFT_STORAGE_PREFIX}${caseId}`),
  )
}

export function CaseInboxAdminClient({
  initialInbox = null,
  initialError = null,
  initialCustomerContext = null,
  initialCustomerCaseKey = null,
}: {
  initialInbox?: AdminSupportInboxResult | null
  initialError?: string | null
  initialCustomerContext?: SupportCaseCustomerContext | null
  initialCustomerCaseKey?: string | null
}) {
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

  const [items, setItems] = useState<CaseInboxItem[]>(initialInbox?.items ?? [])
  const [counts, setCounts] = useState<InboxViewCounts>(
    initialInbox?.counts ?? EMPTY_INBOX_VIEW_COUNTS,
  )
  const [hasMore, setHasMore] = useState(initialInbox?.hasMore ?? false)
  const [nextOffset, setNextOffset] = useState(initialInbox?.nextOffset ?? 0)
  const [loading, setLoading] = useState(!initialInbox)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [sort, setSort] = useState<CaseInboxSort>(DEFAULT_INBOX_SORT)
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
  const [orderExtras, setOrderExtras] = useState<CaseOrderLabelContext | null>(null)
  const [threadReloadToken, setThreadReloadToken] = useState(0)
  const [threadMessages, setThreadMessages] = useState<SupportCaseThreadMessage[]>([])
  const [threadEvents, setThreadEvents] = useState<SupportCaseEventRow[]>([])
  const [threadCaseId, setThreadCaseId] = useState<string | null>(null)
  const [composerMode, setComposerMode] = useState<ComposerMode>("reply")
  const [draft, setDraft] = useState("")
  const [draftCaseId, setDraftCaseId] = useState<string | null>(null)

  const [savePending, startSave] = useTransition()
  const [replyPending, startReply] = useTransition()
  const composerRef = useRef<CaseInboxComposerHandle>(null)
  const selectedKeyRef = useRef<string | null>(selectedKey)
  selectedKeyRef.current = selectedKey
  const skipNoteBlur = useRef(false)
  const loadGenerationRef = useRef(0)
  const loadQueryRef = useRef(
    inboxLoadQueryKey({
      view: parsed.view,
      type: parsed.typeOverlay,
      sort: "smart",
      search: "",
    }),
  )
  const [aiAppliedBody, setAiAppliedBody] = useState<string | null>(null)
  const [suggestionDismissed, setSuggestionDismissed] = useState(false)
  const [rewritePrompt, setRewritePrompt] = useState("")
  const consumedAi = useRef<{ id: string; body: string } | null>(null)
  const rewriteRequested = useRef(false)

  const onOrderContextLoaded = useCallback(
    (detail: AdminOrderDetail, extras: CaseOrderLabelContext) => {
      setOrderContext(detail)
      setOrderExtras(extras)
    },
    [],
  )

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

  const load = useCallback(
    async (args: {
      mode?: "initial" | "refresh" | "page"
      offset?: number
      search?: string
      view: CaseInboxView
      type: CaseInboxTypeFilter
      sort: CaseInboxSort
      selectedKey: string | null
    }) => {
      const mode = args.mode ?? "initial"
      const offset = args.offset ?? 0
      const queryKey = inboxLoadQueryKey({
        view: args.view,
        type: args.type,
        sort: args.sort,
        search: args.search ?? "",
      })
      if (mode !== "page") {
        loadGenerationRef.current += 1
        loadQueryRef.current = queryKey
      }
      const requestGeneration = loadGenerationRef.current
      if (mode === "refresh") setRefreshing(true)
      else if (mode === "page") setLoadingMore(true)
      else setLoading(true)

      try {
        const res = await listAdminSupportInboxAction({
          view: args.view,
          type: args.view === "claims" ? "all" : args.type,
          search: args.search ?? "",
          sort: args.sort,
          offset,
          selected_key: args.selectedKey,
        })
        if (
          !shouldApplyInboxLoad({
            mode,
            requestGeneration,
            currentGeneration: loadGenerationRef.current,
            requestQueryKey: queryKey,
            currentQueryKey: loadQueryRef.current,
          })
        ) {
          return
        }
        if ("error" in res) {
          toast.error(res.error)
          if (mode !== "page") {
            setItems([])
            setHasMore(false)
          }
        } else {
          setItems((prev) =>
            mode === "page" ? mergeInboxPageItems(prev, res.items) : res.items,
          )
          setCounts(res.counts)
          setHasMore(res.hasMore)
          setNextOffset(res.nextOffset)
        }
      } finally {
        if (requestGeneration === loadGenerationRef.current) {
          setLoading(false)
          setRefreshing(false)
          setLoadingMore(false)
        }
      }
    },
    [],
  )

  useEffect(() => {
    if (initialError) toast.error(initialError)
  }, [initialError])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const skipFirstQuery = useRef(Boolean(initialInbox))
  useEffect(() => {
    if (skipFirstQuery.current) {
      skipFirstQuery.current = false
      return
    }
    void load({
      mode: "initial",
      offset: 0,
      search: debouncedSearch,
      view,
      type: typeOverlay,
      sort,
      selectedKey: selectedKeyRef.current,
    })
  }, [debouncedSearch, view, typeOverlay, sort, load])

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

  const filtered = useMemo(() => {
    if (debouncedSearch) {
      return sortInboxItems(items, sort)
    }
    return sortInboxItems(
      filterInboxItems(items, {
        status: viewFilters.status,
        type: effectiveType,
        assignee: viewFilters.assignee,
        currentStaffId,
        search: "",
        overdueOnly: viewFilters.overdueOnly,
      }),
      sort,
    )
  }, [items, viewFilters, effectiveType, currentStaffId, debouncedSearch, sort])

  const selected = useMemo(
    () => findInboxItemBySelection(items, selectedKey),
    [items, selectedKey],
  )

  const listItems = useMemo(
    () => pinSelectedInboxItem(filtered, selected),
    [filtered, selected],
  )

  useEffect(() => {
    const nextKey = nextInboxSelectedKey({
      items,
      filtered,
      selectedKey,
      loading,
    })
    // undefined = keep the current key, including an unresolved ?case=
    if (nextKey !== undefined) setSelectedKey(nextKey)
  }, [filtered, items, selectedKey, loading])

  useEffect(() => {
    syncUrl(view, typeOverlay, selectedKey)
  }, [view, typeOverlay, selectedKey, syncUrl])

  useEffect(() => {
    if (!selected) {
      setOrderContext(null)
      setOrderExtras(null)
      setDraft("")
      setComposerMode("reply")
      setDraftCaseId(null)
      setAiAppliedBody(null)
      setSuggestionDismissed(false)
      setRewritePrompt("")
      rewriteRequested.current = false
      return
    }
    skipNoteBlur.current = true
    const note = selected.contact?.internal_notes ?? selected.order?.internal_notes ?? ""
    setPinnedNote(note)
    setSavedNote(note)
    setOsOutcome(selected.order?.outcome ?? "none")
    if (draftCaseId !== selected.id) {
      const savedDraft = readCaseDraft(selected.id)
      setDraft(savedDraft?.body ?? "")
      setComposerMode(savedDraft?.mode ?? "reply")
      setDraftCaseId(selected.id)
      setAiAppliedBody(savedDraft?.suggestionId ? savedDraft.body : null)
      setSuggestionDismissed(savedDraft?.dismissed === true)
      setRewritePrompt(savedDraft?.rewritePrompt ?? "")
      rewriteRequested.current = false
    }
    if (!selected.orderId) {
      setOrderContext(null)
      setOrderExtras(null)
    }
  }, [selected, draftCaseId])

  const selectedId = selected?.id ?? null
  const {
    draft: aiDraft,
    loading: aiLoading,
    error: aiError,
    rating: aiRating,
    ratingPending: aiRatingPending,
    regenerate: regenerateAi,
    rate: rateAi,
  } = useSupportReplyDraft(selected?.isOpen ? selectedId : null)
  const loadedThreadIdRef = useRef<string | null>(null)

  useEffect(() => {
    consumedAi.current = null
  }, [selectedId])

  useEffect(() => {
    if (!selected?.isOpen || !aiDraft || composerMode !== "reply") return
    if (
      !inboxSuggestionBelongsToSelectedCase({
        selectedCaseId: selected.id,
        composerCaseId: draftCaseId,
        suggestionCaseId: aiDraft.caseId,
      })
    ) {
      return
    }
    if (consumedAi.current?.id === aiDraft.id && consumedAi.current.body === aiDraft.body) return
    if (
      !shouldApplyInboxSuggestion({
        currentBody: draft,
        appliedBody: aiAppliedBody,
        nextBody: aiDraft.body,
        rewriteRequested: rewriteRequested.current,
        dismissed: suggestionDismissed,
      })
    ) {
      return
    }
    rewriteRequested.current = false
    setSuggestionDismissed(false)
    setDraft(aiDraft.body)
    setAiAppliedBody(aiDraft.body)
  }, [aiDraft, selected, composerMode, draftCaseId, draft, aiAppliedBody, suggestionDismissed])

  useEffect(() => {
    if (!selectedId || draftCaseId !== selectedId) return
    const key = `${CASE_DRAFT_STORAGE_PREFIX}${selectedId}`
    const prompt = rewritePrompt.trim()
    if (!draft.trim() && !suggestionDismissed && !prompt) {
      window.sessionStorage.removeItem(key)
      return
    }
    const matchesLiveSuggestion =
      composerMode === "reply" &&
      aiDraft?.caseId === selectedId &&
      draft.trim() === aiDraft.body.trim()
    const matchesAppliedSuggestion =
      composerMode === "reply" && Boolean(aiAppliedBody) && draft.trim() === aiAppliedBody?.trim()
    const suggestionId = matchesLiveSuggestion
      ? aiDraft.id
      : matchesAppliedSuggestion
        ? (readCaseDraft(selectedId)?.suggestionId ?? "applied")
        : null
    window.sessionStorage.setItem(
      key,
      serializeStoredCaseComposerDraft({
        body: draft,
        mode: composerMode,
        suggestionId,
        dismissed: suggestionDismissed,
        rewritePrompt: prompt,
      }),
    )
  }, [selectedId, draftCaseId, draft, composerMode, aiDraft, aiAppliedBody, suggestionDismissed, rewritePrompt])

  useEffect(() => {
    if (!selectedId) {
      setThreadMessages([])
      setThreadEvents([])
      setThreadCaseId(null)
      loadedThreadIdRef.current = null
      return
    }
    if (loadedThreadIdRef.current !== selectedId) {
      setThreadMessages([])
      setThreadEvents([])
      loadedThreadIdRef.current = selectedId
    }
    setThreadCaseId(selectedId)
    let cancelled = false
    void getSupportCaseThreadAdminAction(selectedId).then((res) => {
      if (cancelled) return
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      setThreadCaseId(res.case.id)
      setThreadMessages((prev) => {
        if (res.messages.length === 0 && prev.length > 0) return prev
        return res.messages
      })
      setThreadEvents(res.events)
    })
    return () => {
      cancelled = true
    }
  }, [selectedId, threadReloadToken])

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

  function takeSelected() {
    if (!selected || !currentStaffId) return
    const current = selected
    applyAssignee(current.key, currentStaffId)
    startSave(async () => {
      const res = await assignSupportCaseAction({
        backend: "support_case",
        id: current.id,
        assignee_admin_id: currentStaffId,
      })
      if ("error" in res) {
        applyAssignee(current.key, current.assigneeAdminId)
        toast.error(res.error)
        return
      }
      setThreadReloadToken((n) => n + 1)
      toast.success("Conversation assigned to you")
    })
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
    priority?: CaseInboxPriority
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
        priority: patch.priority,
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
        priority: patch.priority ?? next.priority,
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
      setThreadReloadToken((n) => n + 1)
      if (patch.silent) return
      if (patch.status === "in_progress" && !selected.isOpen) {
        toast.success("Reopened")
      } else if (patch.status) {
        toast.success("Status updated")
      } else if (patch.priority) {
        toast.success("Priority updated")
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
      setThreadReloadToken((n) => n + 1)
      toast.success(
        advanceTo ? "Resolved — opened the next conversation" : "Resolved — inbox is clear",
      )
    })
  }

  function sendComposer(disposition: ComposerDisposition) {
    if (!selected) return
    const current = selected
    const body = draft.trim()
    if (!body) {
      toast.error("Write a message first.")
      return
    }
    startReply(async () => {
      const res = await sendSupportCaseAdminReplyAction({
        case_id: current.id,
        content: body,
        is_internal: composerMode === "note",
      })
      if ("error" in res && res.error) {
        toast.error(res.error)
        return
      }
      toast.success(
        composerMode === "note" ? "Note added" : staffSentToast(current.requesterRole),
      )
      const sentMode = composerMode
      if (sentMode === "reply" && aiDraft) {
        consumedAi.current = { id: aiDraft.id, body: aiDraft.body }
      }
      setAiAppliedBody(null)
      setDraft("")
      const now = new Date().toISOString()
      setThreadMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          case_id: current.id,
          author_user_id: currentStaffId,
          author_role: "agent",
          body,
          is_internal: sentMode === "note",
          created_at: now,
        },
      ])
      const nextStatus =
        sentMode === "note"
          ? current.status
          : disposition === "resolve"
            ? "resolved"
            : disposition === "waiting"
              ? "waiting_on_you"
              : current.status === "submitted" ||
                  current.status === "in_review" ||
                  current.status === "waiting_on_you"
                ? "in_progress"
                : current.status
      const next = nextStatus !== current.status ? withInboxStatus(current, nextStatus) : current
      patchItem(current.key, {
        ...next,
        preview: sentMode === "note" ? `Note: ${body}` : body,
        updatedAt: now,
      })
      if (disposition === "resolve" && sentMode === "reply") {
        resolveSelected()
      } else if (disposition === "waiting" && sentMode === "reply") {
        persistInbox({ status: "waiting_on_you", silent: true })
      } else {
        setThreadReloadToken((n) => n + 1)
      }
    })
  }

  function selectRelative(delta: number) {
    if (listItems.length === 0) return
    const index = listItems.findIndex((item) => item.key === selectedKey)
    const next = index < 0 ? 0 : Math.min(listItems.length - 1, Math.max(0, index + delta))
    setSelectedKey(listItems[next]!.key)
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

  const emptyLabel = debouncedSearch
    ? "No conversations match that search."
    : items.length === 0
      ? "No conversations yet."
      : "Nothing in this view."

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b border-border/60 px-3 py-2">
        <div className="min-w-0">
          <h1 className="text-sm font-semibold tracking-tight text-foreground">Support operations</h1>
          <p className="hidden text-[11px] text-muted-foreground sm:block">
            Admin only ·{" "}
            <Link href="/help" className="underline-offset-2 hover:underline">
              Help / FAQ
            </Link>
            {" · "}
            {counts.open} open conversations
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <AdminCreateSupportCaseDialog
            onCreated={(caseId) => {
              const key = inboxCaseKey(caseId)
              setSelectedKey(key)
              void load({
                mode: "refresh",
                offset: 0,
                search: debouncedSearch,
                view,
                type: typeOverlay,
                sort,
                selectedKey: key,
              })
            }}
          />
          {selected ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", detailsOpen && "bg-muted")}
              onClick={() => setDetailsOpen((open) => !open)}
              aria-label={detailsOpen ? "Hide conversation details" : "Show conversation details"}
              aria-pressed={detailsOpen}
            >
              <PanelRight className="h-4 w-4" />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              setThreadReloadToken((n) => n + 1)
              void load({
                mode: "refresh",
                offset: 0,
                search: debouncedSearch,
                view,
                type: typeOverlay,
                sort,
                selectedKey: selectedKeyRef.current,
              })
            }}
            disabled={refreshing}
            aria-label="Refresh inbox and conversation"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden h-full w-[168px] shrink-0 flex-col overflow-y-auto border-r border-border/60 2xl:flex">
          <CaseInboxViews active={view} counts={counts} onChange={setView} />
        </aside>

        <section
          className={cn(
            "h-full min-h-0 flex-col overflow-hidden border-border/60 md:flex md:w-[260px] md:shrink-0 md:border-r xl:w-[280px]",
            selectedKey ? "hidden md:flex" : "flex w-full",
          )}
        >
          <div className="shrink-0 border-b border-border/40 px-2 py-2 2xl:hidden">
            <CaseInboxViews compact active={view} counts={counts} onChange={setView} />
          </div>
          <CaseInboxListPane
            items={listItems}
            staffNames={staffNames}
            view={view}
            selectedKey={selectedKey}
            search={search}
            sort={sort}
            typeFilter={typeOverlay}
            showTypeFilter={view !== "claims"}
            loading={loading}
            loadingMore={loadingMore}
            hasMore={hasMore}
            emptyLabel={emptyLabel}
            searchHint={
              debouncedSearch
                ? "Searching subjects, people, and message history"
                : undefined
            }
            onSearch={setSearch}
            onSort={setSort}
            onTypeFilter={setTypeOverlay}
            onSelect={setSelectedKey}
            onLoadMore={() =>
              void load({
                mode: "page",
                offset: nextOffset,
                search: debouncedSearch,
                view,
                type: typeOverlay,
                sort,
                selectedKey: selectedKeyRef.current,
              })
            }
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
                  detailsOpen ? "hidden md:flex" : "flex",
                )}
              >
                <CaseInboxConversation
                  key={selected.key}
                  item={selected}
                  messages={threadMessages}
                  threadCaseId={threadCaseId ?? selected.id}
                  staff={staff}
                  staffNames={staffNames}
                  currentStaffId={currentStaffId}
                  canCreditWallet={isAdmin}
                  onWalletCredited={() => {
                    setThreadReloadToken((n) => n + 1)
                  }}
                  orderContext={orderContext}
                  composerRef={composerRef}
                  mode={composerMode}
                  draft={draft}
                  pending={replyPending}
                  savePending={savePending}
                  onBack={() => setSelectedKey(null)}
                  onTake={takeSelected}
                  onAssigned={(id) => {
                    applyAssignee(selected.key, id)
                    setThreadReloadToken((n) => n + 1)
                  }}
                  onStatus={(status) => persistInbox({ status })}
                  onPriority={(priority) => persistInbox({ priority })}
                  onResolve={() => persistInbox({ status: "resolved" })}
                  onModeChange={setComposerMode}
                  onDraftChange={(value) => {
                    if (!value.trim() && draft.trim()) {
                      setSuggestionDismissed(true)
                    }
                    setDraft(value)
                  }}
                  rewritePrompt={rewritePrompt}
                  onRewritePromptChange={setRewritePrompt}
                  onInsertMacro={(text) =>
                    setDraft((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text))
                  }
                  onSend={sendComposer}
                  aiLoading={aiLoading}
                  aiActive={Boolean(
                    aiDraft && draft.trim() && draft.trim() === (aiAppliedBody ?? "").trim(),
                  )}
                  aiError={aiError}
                  aiHelp={aiDraft?.citedHelp}
                  aiReason={aiDraft?.reason}
                  aiOrders={aiDraft?.citedOrders}
                  aiTickets={aiDraft?.citedTickets}
                  onRegenerateAi={() => {
                    consumedAi.current = null
                    rewriteRequested.current = true
                    setSuggestionDismissed(false)
                    regenerateAi({
                      instruction: rewritePrompt,
                      currentDraft: draft,
                    })
                  }}
                  onRateAi={rateAi}
                  aiRating={aiRating}
                  aiRatingPending={aiRatingPending}
                />
              </div>
              <div
                className={cn(
                  "h-full min-h-0 overflow-hidden",
                  detailsOpen ? "flex min-w-0 flex-1 md:w-[320px] md:flex-none xl:w-[340px]" : "hidden",
                )}
              >
                <CaseInboxDetails
                  item={selected}
                  staff={staff}
                  currentStaffId={currentStaffId}
                  isAdmin={isAdmin}
                  initialCustomerContext={
                    findInboxItemBySelection([selected], initialCustomerCaseKey)
                      ? initialCustomerContext
                      : null
                  }
                  osOutcome={osOutcome}
                  pinnedNote={pinnedNote}
                  savePending={savePending}
                  orderContext={orderContext}
                  events={threadEvents}
                  staffNames={staffNames}
                  onAssigned={(id) => {
                    applyAssignee(selected.key, id)
                    setThreadReloadToken((n) => n + 1)
                  }}
                  onStatus={(status) => persistInbox({ status })}
                  onPriority={(priority) => persistInbox({ priority })}
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
                  onOrderLinked={(order) => {
                    patchItem(selected.key, {
                      backend: "order_support",
                      orderId: order.id,
                      orderRef: order.orderRef,
                    })
                    setOrderContext(null)
                    setOrderExtras(null)
                    setThreadReloadToken((n) => n + 1)
                    void load({
                      mode: "refresh",
                      offset: 0,
                      search: debouncedSearch,
                      view,
                      type: typeOverlay,
                      sort,
                      selectedKey: selectedKeyRef.current,
                    })
                  }}
                  onSellerOutreachSent={() => {
                    setThreadReloadToken((n) => n + 1)
                    void load({
                      mode: "refresh",
                      offset: 0,
                      search: debouncedSearch,
                      view,
                      type: typeOverlay,
                      sort,
                      selectedKey: selectedKeyRef.current,
                    })
                  }}
                  onRefundComplete={() => {
                    void load({
                      mode: "refresh",
                      offset: 0,
                      search: debouncedSearch,
                      view,
                      type: typeOverlay,
                      sort,
                      selectedKey: selectedKeyRef.current,
                    })
                    setThreadReloadToken((n) => n + 1)
                  }}
                  onWalletCredited={() => {
                    setThreadReloadToken((n) => n + 1)
                  }}
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
