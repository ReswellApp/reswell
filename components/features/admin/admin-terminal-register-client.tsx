"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { toast } from "sonner"
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Loader2,
  Monitor,
  Search,
  Terminal,
  User,
  X,
} from "lucide-react"
import type { AdminMarketplaceProfilePickerRow } from "@/lib/services/adminStartMarketplaceConversation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { AdminTerminalCardCheckout } from "@/components/features/admin/admin-terminal-card-checkout"

type TerminalReaderRef = {
  id: string
  label: string
  status: string | null
  deviceType: string
  serialNumber: string | null
}

type ListingPreview = {
  id: string
  title: string
  slug: string | null
  sellerId: string
  status: string
  itemPrice: number
  shippingPrice: number
  pickupAvailable: boolean
  shippingAvailable: boolean
  suggestedFulfillment: "pickup" | "shipping"
  coverUrl: string | null
}

type ListingSearchHit = {
  id: string
  slug: string | null
  title: string
  status: string
  price: number
  hiddenFromSite: boolean
  coverUrl: string | null
  pickupAvailable: boolean
  shippingAvailable: boolean
}

type Phase = "setup" | "charging" | "settlement_failed" | "confirm"
type CustomerMode = "guest" | "member"
type PaymentMethod = "terminal" | "card" | "cash"

const POLL_INTERVAL_MS = 2500
const POLL_TIMEOUT_MS = 90_000
const SEARCH_DEBOUNCE_MS = 250
const MEMBER_SEARCH_DEBOUNCE_MS = 300

function money(value: number) {
  return `$${value.toFixed(2)}`
}

function MemberAvatar({ row }: { row: AdminMarketplaceProfilePickerRow }) {
  return (
    <Avatar className="h-9 w-9 shrink-0">
      {row.avatar_url ? <AvatarImage src={row.avatar_url} alt="" /> : null}
      <AvatarFallback className="text-xs">
        {(row.display_name ?? row.email ?? "?")[0]?.toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}

export function AdminTerminalRegisterClient() {
  const [phase, setPhase] = useState<Phase>("setup")
  const [listingRef, setListingRef] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchHits, setSearchHits] = useState<ListingSearchHit[]>([])
  const [searching, setSearching] = useState(false)

  const [customerFirstName, setCustomerFirstName] = useState("")
  const [customerLastName, setCustomerLastName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")

  const [customerMode, setCustomerMode] = useState<CustomerMode>("guest")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("terminal")
  const [memberSearch, setMemberSearch] = useState("")
  const [memberSearchDebounced, setMemberSearchDebounced] = useState("")
  const [memberHits, setMemberHits] = useState<AdminMarketplaceProfilePickerRow[]>([])
  const [memberSearching, setMemberSearching] = useState(false)
  const [selectedMember, setSelectedMember] = useState<AdminMarketplaceProfilePickerRow | null>(null)

  const [preview, setPreview] = useState<ListingPreview | null>(null)

  const [readers, setReaders] = useState<TerminalReaderRef[]>([])
  const [readersError, setReadersError] = useState<string | null>(null)
  const [terminalLocationId, setTerminalLocationId] = useState<string | null>(null)
  const [readerId, setReaderId] = useState("")

  const [previewBusy, setPreviewBusy] = useState(false)
  const [cashBusy, setCashBusy] = useState(false)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [settlementError, setSettlementError] = useState<string | null>(null)

  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollStartedAt = useRef<number>(0)
  const chargeAbortedRef = useRef(false)

  useEffect(() => {
    let active = true
    fetch("/api/admin/terminal/readers")
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!active) return
        if (!ok) {
          setReadersError(j?.error ?? "Couldn't load readers.")
          return
        }
        const list = (j?.data?.readers ?? []) as TerminalReaderRef[]
        setReaders(list)
        setTerminalLocationId((j?.data?.locationId as string | undefined) ?? null)
        const online = list.find((r) => r.status === "online") ?? list[0]
        if (online) setReaderId(online.id)
      })
      .catch(() => active && setReadersError("Couldn't load readers."))
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current)
    }
  }, [])

  useEffect(() => {
    if (phase === "charging") return
    const q = searchQuery.trim()
    if (!q) {
      setSearchHits([])
      setSearching(false)
      return
    }

    setSearching(true)
    const timer = setTimeout(() => {
      void fetch(`/api/admin/terminal/listings/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
        .then(({ ok, j }) => {
          if (!ok) {
            setSearchHits([])
            return
          }
          setSearchHits((j?.data?.hits ?? []) as ListingSearchHit[])
        })
        .catch(() => setSearchHits([]))
        .finally(() => setSearching(false))
    }, SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [searchQuery, phase])

  useEffect(() => {
    const timer = window.setTimeout(() => setMemberSearchDebounced(memberSearch.trim()), MEMBER_SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [memberSearch])

  useEffect(() => {
    if (phase === "charging" || customerMode !== "member") return
    if (memberSearchDebounced.length < 2) {
      setMemberHits([])
      setMemberSearching(false)
      return
    }

    let cancelled = false
    setMemberSearching(true)
    const params = new URLSearchParams()
    params.set("q", memberSearchDebounced)
    params.set("limit", "20")
    void fetch(`/api/admin/terminal/customers/search?${params}`)
      .then(async (res) => {
        const body = (await res.json()) as {
          data?: { hits?: AdminMarketplaceProfilePickerRow[] }
          error?: string
        }
        if (cancelled) return
        if (!res.ok) {
          setMemberHits([])
          return
        }
        setMemberHits(body.data?.hits ?? [])
      })
      .catch(() => {
        if (!cancelled) setMemberHits([])
      })
      .finally(() => {
        if (!cancelled) setMemberSearching(false)
      })

    return () => {
      cancelled = true
    }
  }, [memberSearchDebounced, customerMode, phase])

  const loadListingPreview = useCallback(async (opts: { listingRef?: string; listingId?: string }) => {
    setPreviewBusy(true)
    setPreview(null)
    try {
      const params = new URLSearchParams()
      if (opts.listingId) params.set("listing_id", opts.listingId)
      else if (opts.listingRef) params.set("listing_ref", opts.listingRef)

      const res = await fetch(`/api/admin/terminal/listing-preview?${params}`)
      const body = (await res.json()) as { data?: ListingPreview; error?: string }
      if (!res.ok || !body.data) {
        toast.error(body.error ?? "Could not load listing")
        return false
      }
      setPreview(body.data)
      return true
    } catch {
      toast.error("Could not load listing")
      return false
    } finally {
      setPreviewBusy(false)
    }
  }, [])

  const chargeAmount = preview?.itemPrice ?? 0

  async function handlePreviewListing() {
    const trimmed = listingRef.trim()
    if (!trimmed) {
      toast.error("Enter a listing UUID, slug, or gear URL")
      return
    }

    const ok = await loadListingPreview({ listingRef: trimmed })
    if (ok) toast.success("Listing loaded")
  }

  async function handleSelectSearchHit(hit: ListingSearchHit) {
    const ok = await loadListingPreview({ listingId: hit.id })
    if (ok) {
      setListingRef(hit.slug ?? hit.id)
      toast.success("Listing selected")
    }
  }

  function resetSale() {
    chargeAbortedRef.current = true
    if (pollTimer.current) clearTimeout(pollTimer.current)
    setPhase("setup")
    setPaymentIntentId(null)
    setOrderId(null)
    setSettlementError(null)
    setSelectedMember(null)
    setMemberSearch("")
    setMemberSearchDebounced("")
    setMemberHits([])
  }

  function handleOrderConfirmed(confirmedOrderId: string) {
    setOrderId(confirmedOrderId)
    setSettlementError(null)
    setPhase("confirm")
    toast.success("Order confirmed")
  }

  const checkoutPayload =
    preview && customerMode === "member" && selectedMember
      ? { listingId: preview.id, buyerId: selectedMember.id }
      : preview && customerMode === "guest" && customerFirstName.trim() && customerEmail.trim()
        ? {
            listingId: preview.id,
            customer: {
              firstName: customerFirstName.trim(),
              lastName: customerLastName.trim() || undefined,
              email: customerEmail.trim(),
              phone: customerPhone.trim() || undefined,
            },
          }
        : null

  const customerDetailsReady =
    customerMode === "member" ? Boolean(selectedMember) : Boolean(customerFirstName.trim() && customerEmail.trim())

  function handleCustomerModeChange(mode: CustomerMode) {
    setCustomerMode(mode)
    if (mode === "guest") {
      setSelectedMember(null)
      setMemberSearch("")
      setMemberSearchDebounced("")
      setMemberHits([])
    } else {
      setCustomerFirstName("")
      setCustomerLastName("")
      setCustomerEmail("")
      setCustomerPhone("")
    }
  }

  async function pollFinalize(piId: string) {
    if (Date.now() - pollStartedAt.current > POLL_TIMEOUT_MS) {
      setSettlementError(
        "Payment may have succeeded on Stripe but order settlement timed out. Retry settlement below.",
      )
      setPhase("settlement_failed")
      toast.error("Timed out waiting for order settlement.")
      return
    }

    try {
      const res = await fetch("/api/admin/terminal/sale/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId: piId }),
      })
      const json = await res.json()
      if (res.ok && json?.data?.settled) {
        setOrderId(json.data.orderId as string)
        setSettlementError(null)
        setPhase("confirm")
        toast.success("Order confirmed")
        return
      }
      if (!res.ok && typeof json?.error === "string" && json.error.trim()) {
        setSettlementError(json.error.trim())
        setPhase("settlement_failed")
        toast.error(json.error.trim())
        return
      }
      const status = json?.data?.status as string | undefined
      // Terminal PIs stay at requires_payment_method until the card is tapped — not a failure.
      if (status === "canceled") {
        if (!chargeAbortedRef.current) {
          toast.error("Payment didn't complete. Try again.")
        }
        setPhase("setup")
        return
      }
    } catch {
      // transient — keep polling
    }

    pollTimer.current = setTimeout(() => void pollFinalize(piId), POLL_INTERVAL_MS)
  }

  async function retrySettlement() {
    if (!paymentIntentId) {
      toast.error("No payment to settle")
      return
    }
    chargeAbortedRef.current = false
    setSettlementError(null)
    setPhase("charging")
    pollStartedAt.current = Date.now()
    pollTimer.current = setTimeout(() => void pollFinalize(paymentIntentId), POLL_INTERVAL_MS)
  }

  async function acceptCashAtRegister() {
    if (!preview || !checkoutPayload) {
      toast.error("Complete customer details first")
      return
    }

    chargeAbortedRef.current = false
    setCashBusy(true)
    try {
      const res = await fetch("/api/admin/terminal/sale/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkoutPayload),
      })
      const json = (await res.json()) as { data?: { orderId?: string }; error?: string }
      if (!res.ok || !json.data?.orderId) {
        toast.error(json.error ?? "Could not record cash sale")
        return
      }
      handleOrderConfirmed(json.data.orderId)
    } catch {
      toast.error("Could not record cash sale")
    } finally {
      setCashBusy(false)
    }
  }

  async function startCharge() {
    if (!preview) {
      toast.error("Load a listing first")
      return
    }
    if (!readerId) {
      toast.error("Select a card reader")
      return
    }
    if (customerMode === "member") {
      if (!selectedMember) {
        toast.error("Select a member account")
        return
      }
      if (preview.sellerId === selectedMember.id) {
        toast.error("The seller cannot be the buyer for this listing")
        return
      }
    } else {
      if (!customerFirstName.trim()) {
        toast.error("Enter the customer's first name")
        return
      }
      if (!customerEmail.trim()) {
        toast.error("Enter the customer's email")
        return
      }
    }

    chargeAbortedRef.current = false
    setPhase("charging")
    try {
      const payload =
        customerMode === "member" && selectedMember
          ? {
              listingId: preview.id,
              readerId,
              buyerId: selectedMember.id,
            }
          : {
              listingId: preview.id,
              readerId,
              customer: {
                firstName: customerFirstName.trim(),
                lastName: customerLastName.trim() || undefined,
                email: customerEmail.trim(),
                phone: customerPhone.trim() || undefined,
              },
            }

      const res = await fetch("/api/admin/terminal/sale/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json?.error ?? "Couldn't start the sale")
        setPhase("setup")
        return
      }
      const piId = json.data.paymentIntentId as string
      setPaymentIntentId(piId)
      pollStartedAt.current = Date.now()
      pollTimer.current = setTimeout(() => void pollFinalize(piId), POLL_INTERVAL_MS)
    } catch {
      toast.error("Couldn't start the sale")
      setPhase("setup")
    }
  }

  async function cancelCharge() {
    if (paymentIntentId) {
      try {
        await fetch("/api/admin/terminal/sale/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentIntentId, readerId }),
        })
      } catch {
        // ignore
      }
    }
    resetSale()
  }

  if (phase === "settlement_failed" && preview) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Payment collected — settlement needed</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Stripe may have charged the card, but the Reswell order was not created yet.
          </p>
          {settlementError ? (
            <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {settlementError}
            </p>
          ) : null}
          {paymentIntentId ? (
            <p className="mt-2 text-xs text-muted-foreground break-all">PaymentIntent: {paymentIntentId}</p>
          ) : null}
        </div>
        <Button className="w-full" onClick={() => void retrySettlement()}>
          Retry order settlement
        </Button>
        {orderId ? (
          <Button asChild variant="secondary" className="w-full">
            <Link href={`/admin/orders/${orderId}`}>View order in admin</Link>
          </Button>
        ) : null}
        <Button variant="outline" className="w-full" onClick={resetSale}>
          Back to register
        </Button>
      </div>
    )
  }

  if (phase === "confirm" && preview) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-8">
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
          <h2 className="mt-4 text-xl font-semibold">Order confirmed</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {preview.title} — {money(chargeAmount)}
          </p>
          {orderId ? (
            <p className="mt-2 text-xs text-muted-foreground">Order ID: {orderId}</p>
          ) : null}
        </div>
        {orderId ? (
          <Button asChild className="w-full">
            <Link href={`/admin/orders/${orderId}`}>View order in admin</Link>
          </Button>
        ) : null}
        <Button variant="outline" className="w-full" onClick={resetSale}>
          New sale
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {paymentMethod === "terminal" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Terminal className="h-5 w-5" />
              Stripe Terminal
            </CardTitle>
            <CardDescription>
              Ring up any marketplace listing on your S710 reader. Requires{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">STRIPE_TERMINAL_LOCATION_ID</code>{" "}
              in env with your reader registered to that location.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {readersError ? (
              <p className="text-sm text-destructive">{readersError}</p>
            ) : readers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Looking for readers…</p>
            ) : (
              <div className="space-y-2">
                <Label>Card reader</Label>
                <Select
                  value={readerId}
                  onValueChange={setReaderId}
                  disabled={phase === "charging"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select reader" />
                  </SelectTrigger>
                  <SelectContent>
                    {readers.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.label}
                        {r.deviceType ? ` · ${r.deviceType}` : ""}
                        {r.status ? ` · ${r.status}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {terminalLocationId ? (
                  <p className="text-xs text-muted-foreground">
                    Location: <code>{terminalLocationId}</code>
                  </p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Listing</CardTitle>
          <CardDescription>
            Search by title, brand, or slug — or paste a UUID, slug, or gear URL. Hidden listings
            are included.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search listings…"
              className="pl-9"
              disabled={phase === "charging"}
            />
          </div>

          {searchQuery.trim() ? (
            <div className="space-y-2">
              {searching ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching…
                </div>
              ) : searchHits.length === 0 ? (
                <p className="text-sm text-muted-foreground">No listings matched that search.</p>
              ) : (
                <div className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
                  {searchHits.map((hit) => (
                    <button
                      key={hit.id}
                      type="button"
                      disabled={previewBusy || phase === "charging"}
                      onClick={() => void handleSelectSearchHit(hit)}
                      className={cn(
                        "flex gap-3 rounded-lg border p-2 text-left transition hover:border-foreground/30",
                        preview?.id === hit.id && "border-foreground/40 bg-muted/40",
                      )}
                    >
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                        {hit.coverUrl ? (
                          <Image
                            src={hit.coverUrl}
                            alt={hit.title}
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium leading-tight">{hit.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {money(hit.price)} · {hit.status}
                          {hit.hiddenFromSite ? " · hidden" : ""}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row">
            <Input
              value={listingRef}
              onChange={(e) => setListingRef(e.target.value)}
              placeholder="Or paste UUID, slug, or URL"
              disabled={phase === "charging"}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handlePreviewListing()
              }}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={previewBusy || phase === "charging"}
              onClick={() => void handlePreviewListing()}
            >
              {previewBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load directly"}
            </Button>
          </div>

          {preview ? (
            <div className="flex gap-4 rounded-lg border p-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                {preview.coverUrl ? (
                  <Image
                    src={preview.coverUrl}
                    alt={preview.title}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-medium leading-tight">{preview.title}</p>
                <p className="text-sm text-muted-foreground">
                  Item {money(preview.itemPrice)}
                  {preview.shippingAvailable ? ` · Ship +${money(preview.shippingPrice)}` : null}
                </p>
                <Badge variant="outline">{preview.status}</Badge>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Customer</CardTitle>
          <CardDescription>
            Charge a walk-in guest or link the sale to an existing Reswell member account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs
            value={customerMode}
            onValueChange={(value) => handleCustomerModeChange(value as CustomerMode)}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="guest" disabled={phase === "charging"}>
                Walk-in guest
              </TabsTrigger>
              <TabsTrigger value="member" disabled={phase === "charging"}>
                Existing member
              </TabsTrigger>
            </TabsList>

            <TabsContent value="guest" className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customer-first-name">First name</Label>
                  <Input
                    id="customer-first-name"
                    value={customerFirstName}
                    onChange={(e) => setCustomerFirstName(e.target.value)}
                    placeholder="Alex"
                    disabled={phase === "charging"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-last-name">Last name</Label>
                  <Input
                    id="customer-last-name"
                    value={customerLastName}
                    onChange={(e) => setCustomerLastName(e.target.value)}
                    placeholder="Rivera"
                    disabled={phase === "charging"}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customer-email">Email</Label>
                  <Input
                    id="customer-email"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="customer@example.com"
                    disabled={phase === "charging"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-phone">Phone</Label>
                  <Input
                    id="customer-phone"
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="555-0100"
                    disabled={phase === "charging"}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="member" className="mt-4 space-y-4">
              {selectedMember ? (
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <MemberAvatar row={selectedMember} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {selectedMember.display_name?.trim() || "Unnamed member"}
                    </p>
                    {selectedMember.email ? (
                      <p className="truncate text-sm text-muted-foreground">{selectedMember.email}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={phase === "charging"}
                    onClick={() => setSelectedMember(null)}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Search by email or name…"
                      type="search"
                      autoComplete="off"
                      inputMode="email"
                      className="pl-9"
                      disabled={phase === "charging"}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter" || memberHits.length !== 1 || phase === "charging") return
                        e.preventDefault()
                        setSelectedMember(memberHits[0]!)
                        setMemberSearch("")
                        setMemberSearchDebounced("")
                        setMemberHits([])
                      }}
                    />
                  </div>
                  {memberSearchDebounced.length >= 2 ? (
                    <div className="space-y-2">
                      {memberSearching ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Searching members…
                        </div>
                      ) : memberHits.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No members matched that email or name.
                        </p>
                      ) : (
                        <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-1">
                          {memberHits.map((hit) => (
                            <button
                              key={hit.id}
                              type="button"
                              disabled={phase === "charging"}
                              onClick={() => {
                                setSelectedMember(hit)
                                setMemberSearch("")
                                setMemberSearchDebounced("")
                                setMemberHits([])
                              }}
                              className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition hover:bg-muted"
                            >
                              <MemberAvatar row={hit} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">
                                  {hit.display_name?.trim() || "Unnamed member"}
                                </p>
                                {hit.email ? (
                                  <p className="truncate text-xs text-muted-foreground">{hit.email}</p>
                                ) : null}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Type a name or email (min. 2 characters). Paste a full email address for an exact
                      match, including accounts where login email isn&apos;t on the public profile.
                    </p>
                  )}
                </>
              )}
              <p className="text-xs text-muted-foreground">
                The order will appear in the member&apos;s purchase history, open a seller thread, and
                trigger the same post-purchase emails as online checkout.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payment</CardTitle>
            <CardDescription>
              Charge on your S710 reader, enter card details here, or record cash collected at the
              register. In-person admin sales settle immediately with no pickup code — list price
              only, no shipping.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="terminal" disabled={phase === "charging" || cashBusy}>
                  <Terminal className="mr-2 h-4 w-4" />
                  Terminal tap
                </TabsTrigger>
                <TabsTrigger value="card" disabled={phase === "charging" || cashBusy}>
                  <Monitor className="mr-2 h-4 w-4" />
                  Card checkout
                </TabsTrigger>
                <TabsTrigger value="cash" disabled={phase === "charging" || cashBusy}>
                  <Banknote className="mr-2 h-4 w-4" />
                  Cash
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <p className="text-sm text-muted-foreground">
              Total due: <span className="font-semibold text-foreground">{money(chargeAmount)}</span>
            </p>

            {paymentMethod === "terminal" ? (
              phase === "charging" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 rounded-lg border bg-muted/40 py-4 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Follow the prompt on the S710 reader…
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => void cancelCharge()}>
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  className="w-full"
                  disabled={!readerId || !customerDetailsReady || cashBusy}
                  onClick={() => void startCharge()}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Charge {money(chargeAmount)} on reader
                </Button>
              )
            ) : paymentMethod === "card" ? (
              <AdminTerminalCardCheckout
                listingId={preview.id}
                amountUsd={chargeAmount}
                checkoutPayload={checkoutPayload}
                disabled={!customerDetailsReady || phase === "charging" || cashBusy}
                onOrderConfirmed={handleOrderConfirmed}
              />
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Confirm after you have collected {money(chargeAmount)} in cash from the customer.
                </p>
                <Button
                  className="w-full"
                  disabled={!customerDetailsReady || phase === "charging" || cashBusy}
                  onClick={() => void acceptCashAtRegister()}
                >
                  {cashBusy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Recording sale…
                    </>
                  ) : (
                    <>
                      <Banknote className="mr-2 h-4 w-4" />
                      Accepted cash at register
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
