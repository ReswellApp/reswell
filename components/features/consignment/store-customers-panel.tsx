"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { StoreCustomerListItem } from "@/lib/db/consignmentStores"

interface StoreCustomersPanelProps {
  storeId: string
  initialCustomers: StoreCustomerListItem[]
}

export function StoreCustomersPanel({ storeId, initialCustomers }: StoreCustomersPanelProps) {
  const router = useRouter()
  const [customers, setCustomers] = useState(initialCustomers)
  const [query, setQuery] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setCustomers(initialCustomers)
  }, [initialCustomers])

  const filtered = customers.filter((c) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    const haystack = [c.firstName, c.lastName ?? "", c.email, c.phoneE164 ?? ""]
      .join(" ")
      .toLowerCase()
    return haystack.includes(q)
  })

  async function addCustomer(e: React.FormEvent) {
    e.preventDefault()
    try {
      const res = await fetch("/api/consignment/store/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          email: email.trim(),
          phoneE164: phone.trim() || undefined,
        }),
      })
      const json = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(json?.error ?? "Could not save customer")
      toast.success("Customer saved")
      setFirstName("")
      setLastName("")
      setEmail("")
      setPhone("")
      startTransition(() => router.refresh())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save customer")
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={addCustomer} className="rounded-lg border p-4 space-y-3">
        <p className="text-sm font-medium">Add customer</p>
        <p className="text-xs text-muted-foreground">
          Walk-in and register customers are saved to your shop only — not shared with other stores
          or Reswell&apos;s marketplace buyer list.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="customer-first">First name</Label>
            <Input
              id="customer-first"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="customer-last">Last name</Label>
            <Input
              id="customer-last"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="customer-email">Email</Label>
            <Input
              id="customer-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="customer-phone">Phone</Label>
            <Input
              id="customer-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save customer
        </Button>
      </form>

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium">Your customers ({customers.length})</p>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email…"
            className="sm:max-w-xs"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
            {customers.length === 0
              ? "No customers yet. Add one above or capture them at the register."
              : "No customers match your search."}
          </p>
        ) : (
          <div className="divide-y rounded-lg border">
            {filtered.map((c) => (
              <div key={c.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {[c.firstName, c.lastName].filter(Boolean).join(" ")}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  {c.phoneE164 ? <span>{c.phoneE164}</span> : null}
                  <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
