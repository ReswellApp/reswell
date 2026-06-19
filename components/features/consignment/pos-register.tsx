"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { toast } from "sonner"
import { Loader2, Search, CheckCircle2, CreditCard, Banknote, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { StoreInventoryItem, TerminalReaderRef } from "./pos-types"

interface PosRegisterProps {
  storeId: string
  storeSlug: string
  storeName: string
  initialInventory: StoreInventoryItem[]
}

type Phase = "browse" | "review" | "charging" | "success"

const POLL_INTERVAL_MS = 2500
const POLL_TIMEOUT_MS = 90_000

export function PosRegister({ storeId, storeSlug, storeName, initialInventory }: PosRegisterProps) {
  const [phase, setPhase] = useState<Phase>("browse")
  const [inventory, setInventory] = useState<StoreInventoryItem[]>(initialInventory)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<StoreInventoryItem | null>(null)

  const [readers, setReaders] = useState<TerminalReaderRef[]>([])
  const [readersError, setReadersError] = useState<string | null>(null)
  const [readerId, setReaderId] = useState<string>("")

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")

  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [cashSubmitting, setCashSubmitting] = useState(false)
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollStartedAt = useRef<number>(0)

  useEffect(() => {
    let active = true
    fetch(`/api/pos/readers?store=${encodeURIComponent(storeSlug)}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!active) return
        if (!ok) {
          setReadersError(j?.error ?? "Couldn't load readers.")
          return
        }
        const list = (j?.data?.readers ?? []) as TerminalReaderRef[]
        setReaders(list)
        const online = list.find((r) => r.status === "online") ?? list[0]
        if (online) setReaderId(online.id)
      })
      .catch(() => active && setReadersError("Couldn't load readers."))
    return () => {
      active = false
    }
  }, [storeSlug])

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current)
    }
  }, [])

  async function runSearch(q: string) {
    setQuery(q)
    try {
      const res = await fetch(
        `/api/pos/inventory?store=${encodeURIComponent(storeSlug)}&q=${encodeURIComponent(q)}`,
      )
      const json = await res.json()
      if (res.ok) setInventory((json?.data?.inventory ?? []) as StoreInventoryItem[])
    } catch {
      // keep prior list on transient failure
    }
  }

  function resetToBrowse() {
    if (pollTimer.current) clearTimeout(pollTimer.current)
    setPhase("browse")
    setSelected(null)
    setPaymentIntentId(null)
    setFirstName("")
    setLastName("")
    setEmail("")
    setPhone("")
    setCashSubmitting(false)
    void runSearch(query)
  }

  function buildCustomer() {
    return email.trim() && firstName.trim()
      ? {
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          email: email.trim(),
          phoneE164: phone.trim() || undefined,
        }
      : undefined
  }

  async function payCash() {
    if (!selected || cashSubmitting) return
    setCashSubmitting(true)
    try {
      const res = await fetch("/api/pos/sale/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          listingId: selected.listingId,
          customer: buildCustomer(),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json?.error ?? "Couldn't record the cash sale.")
        setCashSubmitting(false)
        return
      }
      setPhase("success")
    } catch {
      toast.error("Couldn't record the cash sale.")
      setCashSubmitting(false)
    }
  }

  async function pollFinalize(piId: string) {
    if (Date.now() - pollStartedAt.current > POLL_TIMEOUT_MS) {
      toast.error("Timed out waiting for the reader. Check the payment in Stripe before retrying.")
      setPhase("review")
      return
    }
    try {
      const res = await fetch("/api/pos/sale/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId: piId }),
      })
      const json = await res.json()
      if (res.ok && json?.data?.settled) {
        setPhase("success")
        return
      }
      const status = json?.data?.status as string | undefined
      if (status === "canceled" || status === "requires_payment_method") {
        toast.error("Payment didn't complete. Try again.")
        setPhase("review")
        return
      }
    } catch {
      // transient — keep polling
    }
    pollTimer.current = setTimeout(() => void pollFinalize(piId), POLL_INTERVAL_MS)
  }

  async function startCharge() {
    if (!selected) return
    if (!readerId) {
      toast.error("Select a card reader.")
      return
    }
    setPhase("charging")
    try {
      const customer = buildCustomer()

      const res = await fetch("/api/pos/sale/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          listingId: selected.listingId,
          readerId,
          customer,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json?.error ?? "Couldn't start the sale.")
        setPhase("review")
        return
      }
      const piId = json.data.paymentIntentId as string
      setPaymentIntentId(piId)
      pollStartedAt.current = Date.now()
      pollTimer.current = setTimeout(() => void pollFinalize(piId), POLL_INTERVAL_MS)
    } catch {
      toast.error("Couldn't start the sale.")
      setPhase("review")
    }
  }

  async function cancelCharge() {
    if (!paymentIntentId) {
      resetToBrowse()
      return
    }
    try {
      await fetch("/api/pos/sale/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId, readerId }),
      })
    } catch {
      // ignore
    }
    resetToBrowse()
  }

  if (phase === "success" && selected) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
        <CheckCircle2 className="h-14 w-14 text-emerald-500" />
        <h2 className="mt-4 text-xl font-semibold">Sale complete</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {selected.title} — ${selected.price.toFixed(2)}
        </p>
        <Button className="mt-8 w-full" onClick={resetToBrowse}>
          New sale
        </Button>
      </div>
    )
  }

  if ((phase === "review" || phase === "charging") && selected) {
    const charging = phase === "charging"
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex items-center gap-4 rounded-lg border p-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
            {selected.coverUrl ? (
              <Image
                src={selected.coverUrl}
                alt={selected.title}
                fill
                sizes="80px"
                className="object-cover"
              />
            ) : null}
          </div>
          <div className="flex-1">
            <h3 className="font-medium leading-tight">{selected.title}</h3>
            <p className="mt-1 text-2xl font-semibold">${selected.price.toFixed(2)}</p>
          </div>
        </div>

        <div className="space-y-3">
          <Label>Card reader</Label>
          {readersError ? (
            <p className="text-sm text-destructive">{readersError}</p>
          ) : readers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Looking for readers…</p>
          ) : (
            <Select value={readerId} onValueChange={setReaderId} disabled={charging}>
              <SelectTrigger>
                <SelectValue placeholder="Select reader" />
              </SelectTrigger>
              <SelectContent>
                {readers.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.label} {r.status ? `· ${r.status}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm font-medium">Customer (optional — for receipt & customer list)</p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={charging}
            />
            <Input
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={charging}
            />
          </div>
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={charging}
          />
          <Input
            type="tel"
            placeholder="Phone (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={charging}
          />
        </div>

        {charging ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 rounded-lg border bg-muted/40 py-4 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Follow the prompt on the reader…
            </div>
            <Button variant="outline" className="w-full" onClick={cancelCharge}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetToBrowse} disabled={cashSubmitting}>
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={startCharge}
                disabled={!readerId || cashSubmitting}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Charge ${selected.price.toFixed(2)}
              </Button>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={payCash}
              disabled={cashSubmitting}
            >
              {cashSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Banknote className="mr-2 h-4 w-4" />
              )}
              Pay cash ${selected.price.toFixed(2)}
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => void runSearch(e.target.value)}
          placeholder={`Search ${storeName} inventory…`}
          className="pl-9"
        />
      </div>

      {inventory.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No active consigned boards to sell.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {inventory.map((item) => (
            <button
              key={item.listingId}
              type="button"
              onClick={() => {
                setSelected(item)
                setPhase("review")
              }}
              className={cn(
                "group flex flex-col overflow-hidden rounded-lg border text-left transition hover:border-foreground/40",
              )}
            >
              <div className="relative aspect-square w-full bg-muted">
                {item.coverUrl ? (
                  <Image
                    src={item.coverUrl}
                    alt={item.title}
                    fill
                    sizes="200px"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="p-2.5">
                <p className="line-clamp-2 text-sm font-medium leading-tight">{item.title}</p>
                <p className="mt-1 text-sm font-semibold">${item.price.toFixed(2)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
