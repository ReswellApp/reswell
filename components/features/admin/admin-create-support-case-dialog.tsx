"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { Loader2, Plus, Search, X } from "lucide-react"
import { toast } from "sonner"
import type { AdminMarketplaceProfilePickerRow } from "@/lib/services/adminStartMarketplaceConversation"
import type { SupportCaseCustomerOrder } from "@/lib/services/supportCaseCustomerContext"
import type { SupportCaseKind } from "@/lib/types/supportCase"
import {
  adminCreateSupportCaseAction,
  listAdminUserOrdersForSupportAction,
} from "@/lib/actions/adminCreateSupportCase"
import { formatCustomerUsd } from "@/lib/admin/case-customer-panel"
import { orderStatusLabel } from "@/lib/order-status"
import { SUPPORT_CASE_KIND_LABEL, suggestedStaffSupportSubject } from "@/lib/utils/support-case-display"
import { ADMIN_CREATE_SUPPORT_CASE_KINDS } from "@/lib/validations/adminCreateSupportCase"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const KIND_OPTIONS = ADMIN_CREATE_SUPPORT_CASE_KINDS

type OrderRoleFilter = "all" | "buyer" | "seller"

function MemberAvatar({ row }: { row: AdminMarketplaceProfilePickerRow }) {
  return (
    <Avatar className="h-8 w-8 shrink-0">
      {row.avatar_url ? <AvatarImage src={row.avatar_url} alt="" /> : null}
      <AvatarFallback className="text-xs">
        {(row.display_name ?? row.email ?? "?")[0]?.toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}

function memberLabel(row: AdminMarketplaceProfilePickerRow): string {
  return row.display_name?.trim() || row.email?.trim() || "Unnamed member"
}

export function AdminCreateSupportCaseDialog({
  onCreated,
  defaultTargetUser = null,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  trigger,
}: {
  onCreated: (caseId: string) => void
  /** Pre-select a member (for example from /admin/users) and skip search. */
  defaultTargetUser?: AdminMarketplaceProfilePickerRow | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Custom trigger. Pass `null` when the parent controls `open`. */
  trigger?: React.ReactNode | null
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = controlledOnOpenChange ?? setInternalOpen
  const memberLocked = Boolean(defaultTargetUser)
  const [dialogSurfaceEl, setDialogSurfaceEl] = useState<HTMLElement | null>(null)
  const [memberPickerOpen, setMemberPickerOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [results, setResults] = useState<AdminMarketplaceProfilePickerRow[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<AdminMarketplaceProfilePickerRow | null>(null)

  const [orderSearch, setOrderSearch] = useState("")
  const [debouncedOrderSearch, setDebouncedOrderSearch] = useState("")
  const [orderRole, setOrderRole] = useState<OrderRoleFilter>("all")
  const [orders, setOrders] = useState<SupportCaseCustomerOrder[]>([])
  const [ordersTotal, setOrdersTotal] = useState(0)
  const [ordersHasMore, setOrdersHasMore] = useState(false)
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersLoadingMore, setOrdersLoadingMore] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<SupportCaseCustomerOrder | null>(null)

  const [kind, setKind] = useState<SupportCaseKind>("general")
  const [subject, setSubject] = useState(suggestedStaffSupportSubject("general", null))
  const [subjectDirty, setSubjectDirty] = useState(false)
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const member = selected ?? (open && defaultTargetUser ? defaultTargetUser : null)

  const applySuggestedSubject = useCallback(
    (nextKind: SupportCaseKind, order: SupportCaseCustomerOrder | null, dirty: boolean) => {
      if (dirty) return
      setSubject(suggestedStaffSupportSubject(nextKind, order?.orderRef))
    },
    [],
  )

  useEffect(() => {
    if (!open || !defaultTargetUser) return
    setSelected((current) =>
      current?.id === defaultTargetUser.id ? current : defaultTargetUser,
    )
  }, [defaultTargetUser, open])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedOrderSearch(orderSearch.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [orderSearch])

  useEffect(() => {
    if (!open || member) return
    if (debounced.length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    let cancelled = false
    setSearching(true)
    const params = new URLSearchParams({ q: debounced, limit: "20" })
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
  }, [debounced, member, open])

  useEffect(() => {
    if (!open || !member) {
      setOrders([])
      setOrdersTotal(0)
      setOrdersHasMore(false)
      return
    }
    let cancelled = false
    setOrdersLoading(true)
    void listAdminUserOrdersForSupportAction({
      user_id: member.id,
      offset: 0,
      search: debouncedOrderSearch,
      role: orderRole,
    }).then((result) => {
      if (cancelled) return
      if ("error" in result) {
        toast.error(result.error)
        setOrders([])
        setOrdersTotal(0)
        setOrdersHasMore(false)
      } else {
        setOrders(result.orders)
        setOrdersTotal(result.total)
        setOrdersHasMore(result.hasMore)
      }
      setOrdersLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [debouncedOrderSearch, member?.id, open, orderRole])

  const resetForm = useCallback(() => {
    setSearch("")
    setDebounced("")
    setResults([])
    setSelected(null)
    setMemberPickerOpen(false)
    setOrderSearch("")
    setDebouncedOrderSearch("")
    setOrderRole("all")
    setOrders([])
    setSelectedOrder(null)
    setKind("general")
    setSubject(suggestedStaffSupportSubject("general", null))
    setSubjectDirty(false)
    setMessage("")
  }, [])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) resetForm()
  }

  const selectMember = (row: AdminMarketplaceProfilePickerRow) => {
    setSelected(row)
    setMemberPickerOpen(false)
    setSelectedOrder(null)
    setOrderSearch("")
    setOrderRole("all")
    setKind("general")
    setSubjectDirty(false)
    applySuggestedSubject("general", null, false)
  }

  const selectOrder = (order: SupportCaseCustomerOrder) => {
    const nextKind = kind === "general" ? "order_question" : kind
    setSelectedOrder(order)
    setKind(nextKind)
    applySuggestedSubject(nextKind, order, subjectDirty)
  }

  const clearOrder = () => {
    setSelectedOrder(null)
    applySuggestedSubject(kind, null, subjectDirty)
  }

  const changeKind = (next: SupportCaseKind) => {
    setKind(next)
    applySuggestedSubject(next, selectedOrder, subjectDirty)
  }

  const loadMoreOrders = () => {
    if (!member || ordersLoadingMore) return
    setOrdersLoadingMore(true)
    void listAdminUserOrdersForSupportAction({
      user_id: member.id,
      offset: orders.length,
      search: debouncedOrderSearch,
      role: orderRole,
    }).then((result) => {
      if ("error" in result) {
        toast.error(result.error)
      } else {
        setOrders((prev) => [...prev, ...result.orders])
        setOrdersHasMore(result.hasMore)
        setOrdersTotal(result.total)
      }
      setOrdersLoadingMore(false)
    })
  }

  const submit = async () => {
    if (!member) {
      toast.error("Select a member")
      return
    }
    setSubmitting(true)
    try {
      const result = await adminCreateSupportCaseAction({
        user_id: member.id,
        order_id: selectedOrder?.id ?? null,
        kind,
        subject,
        message,
      })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      if (result.klaviyoNotified) {
        toast.success("Ticket opened. They’ll get an email from Reswell support.")
      } else {
        toast.success("Ticket opened")
        toast.warning("The support email did not send. Check that this member has an email on file.")
      }
      handleOpenChange(false)
      onCreated(result.caseId)
    } catch {
      toast.error("Could not open a support ticket")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger === null ? null : (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button type="button" size="sm" className="h-8 shrink-0 gap-1.5">
              <Plus className="h-3.5 w-3.5" aria-hidden />
              New ticket
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent
        ref={setDialogSurfaceEl}
        className="sm:max-w-lg"
        onPointerDownOutside={(event) => {
          const target = event.target as HTMLElement | null
          if (target?.closest("[data-admin-member-picker]")) event.preventDefault()
        }}
        onFocusOutside={(event) => {
          const target = event.target as HTMLElement | null
          if (target?.closest("[data-admin-member-picker]")) event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>Open a support ticket</DialogTitle>
          <DialogDescription>
            {memberLocked
              ? "Optionally connect one of their orders and send the first message. They will see this in Help and get the Reswell support email."
              : "Find a member, optionally connect one of their orders, and send the first message. They will see this in Help and get the Reswell support email."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="admin-case-user-search">Member</Label>
            {member ? (
              <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/25 px-3 py-2 text-sm">
                <MemberAvatar row={member} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{memberLabel(member)}</p>
                  {member.email ? (
                    <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                  ) : null}
                </div>
                {memberLocked ? null : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0"
                    disabled={submitting}
                    onClick={() => {
                      setSelected(null)
                      setSelectedOrder(null)
                      setMemberPickerOpen(true)
                    }}
                  >
                    Change
                  </Button>
                )}
              </div>
            ) : (
              <Popover
                open={open && memberPickerOpen}
                onOpenChange={setMemberPickerOpen}
                modal={false}
              >
                <PopoverAnchor asChild>
                  <div className="relative w-full">
                    <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="admin-case-user-search"
                      role="combobox"
                      aria-expanded={open && memberPickerOpen}
                      aria-autocomplete="list"
                      placeholder="Name or email (min. 2 characters)"
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value)
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
                  onOpenAutoFocus={(event) => event.preventDefault()}
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
                    ) : results.length === 0 ? (
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
                              onClick={() => selectMember(row)}
                            >
                              <MemberAvatar row={row} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-foreground">
                                  {memberLabel(row)}
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
            )}
          </div>

          {member ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="admin-case-order-search">Order (optional)</Label>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {ordersLoading ? "Loading…" : `${ordersTotal} total`}
                  </span>
                </div>
                {selectedOrder ? (
                  <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        #{selectedOrder.orderRef ?? selectedOrder.id.slice(0, 8)} ·{" "}
                        {selectedOrder.role === "seller" ? "Sale" : "Purchase"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {selectedOrder.listingTitle ?? "Order item"} ·{" "}
                        {formatCustomerUsd(selectedOrder.merchandiseAmount)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      disabled={submitting}
                      onClick={clearOrder}
                      aria-label="Remove connected order"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      id="admin-case-order-search"
                      value={orderSearch}
                      onChange={(event) => setOrderSearch(event.target.value)}
                      placeholder="Search order number…"
                      className="h-8 text-sm"
                      disabled={submitting}
                    />
                    <div className="flex gap-1">
                      {(["all", "buyer", "seller"] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          disabled={submitting}
                          onClick={() => setOrderRole(value)}
                          className={cn(
                            "rounded-md px-2 py-1 text-[10px] font-medium",
                            orderRole === value
                              ? "bg-foreground text-background"
                              : "bg-muted text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {value === "buyer" ? "Purchases" : value === "seller" ? "Sales" : "All"}
                        </button>
                      ))}
                    </div>
                    <div className="max-h-44 divide-y divide-border/50 overflow-y-auto rounded-lg border border-border/60 bg-background">
                      {ordersLoading ? (
                        <p className="px-3 py-5 text-center text-xs text-muted-foreground">
                          Loading orders…
                        </p>
                      ) : orders.length === 0 ? (
                        <p className="px-3 py-5 text-center text-xs text-muted-foreground">
                          No matching orders.
                        </p>
                      ) : (
                        orders.map((order) => (
                          <button
                            key={order.id}
                            type="button"
                            disabled={submitting}
                            onClick={() => selectOrder(order)}
                            className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted/50"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium">
                                {order.listingTitle ?? "Order item"}
                              </p>
                              <p className="truncate text-[10px] text-muted-foreground">
                                #{order.orderRef ?? order.id.slice(0, 8)} ·{" "}
                                {order.role === "seller" ? "Sale" : "Purchase"} ·{" "}
                                {format(new Date(order.createdAt), "MMM d, yyyy")} ·{" "}
                                {formatCustomerUsd(order.merchandiseAmount)} ·{" "}
                                {orderStatusLabel(order.status)}
                              </p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                    {ordersHasMore ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-full text-[11px]"
                        disabled={ordersLoadingMore || submitting}
                        onClick={loadMoreOrders}
                      >
                        {ordersLoadingMore ? (
                          <Loader2 className="mr-1.5 h-3 w-3 animate-spin" aria-hidden />
                        ) : null}
                        Load more orders
                      </Button>
                    ) : null}
                  </>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                <div className="space-y-2">
                  <Label htmlFor="admin-case-kind">Type</Label>
                  <Select
                    value={kind}
                    onValueChange={(value) => changeKind(value as SupportCaseKind)}
                    disabled={submitting}
                  >
                    <SelectTrigger id="admin-case-kind" className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KIND_OPTIONS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {SUPPORT_CASE_KIND_LABEL[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-case-subject">Subject</Label>
                  <Input
                    id="admin-case-subject"
                    value={subject}
                    onChange={(event) => {
                      setSubject(event.target.value)
                      setSubjectDirty(true)
                    }}
                    maxLength={200}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-case-message">First message</Label>
                <Textarea
                  id="admin-case-message"
                  placeholder="This is what the member will see in Help…"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={4}
                  maxLength={8000}
                  disabled={submitting}
                  className="resize-none"
                />
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!member || message.trim().length < 10 || subject.trim().length < 2 || submitting}
            onClick={() => void submit()}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Opening…
              </>
            ) : (
              "Open ticket"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
