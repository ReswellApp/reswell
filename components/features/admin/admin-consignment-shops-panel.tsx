"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
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
import type {
  AdminConsignmentShopOperatorRow,
  AdminConsignmentStoreRow,
} from "@/lib/services/adminConsignmentStoresList"

interface AdminConsignmentShopsPanelProps {
  stores: AdminConsignmentStoreRow[]
  operators: AdminConsignmentShopOperatorRow[]
}

export function AdminConsignmentShopsPanel({
  stores,
  operators,
}: AdminConsignmentShopsPanelProps) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  const [createOwnerId, setCreateOwnerId] = useState("")
  const [createSlug, setCreateSlug] = useState("")
  const [createName, setCreateName] = useState("")
  const [createCommissionPct, setCreateCommissionPct] = useState("25")

  const operatorsWithoutStore = operators.filter((o) => !o.ownedStoreId)
  const operatorOptions = operators.map((o) => ({
    id: o.profileId,
    label: [o.displayName, o.email].filter(Boolean).join(" · ") || o.profileId,
    hasStore: Boolean(o.ownedStoreId),
  }))

  async function refresh() {
    router.refresh()
  }

  async function handleCreateStore(e: React.FormEvent) {
    e.preventDefault()
    if (!createOwnerId || !createSlug.trim() || !createName.trim()) {
      toast.error("Owner, slug, and name are required")
      return
    }

    const commissionBps = Math.round(Number(createCommissionPct) * 100)
    if (!Number.isFinite(commissionBps) || commissionBps < 0 || commissionBps > 10000) {
      toast.error("Commission must be between 0 and 100%")
      return
    }

    setBusy("create")
    try {
      const res = await fetch("/api/admin/consignment-stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerProfileId: createOwnerId,
          slug: createSlug.trim().toLowerCase(),
          name: createName.trim(),
          defaultCommissionBps: commissionBps,
        }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(json.error ?? "Could not create store")
        return
      }
      toast.success("Consignment store created")
      setCreateSlug("")
      setCreateName("")
      await refresh()
    } catch {
      toast.error("Could not create store")
    } finally {
      setBusy(null)
    }
  }

  async function handleTransfer(storeId: string, newOwnerProfileId: string) {
    if (!newOwnerProfileId) {
      toast.error("Choose a new owner")
      return
    }

    setBusy(`transfer-${storeId}`)
    try {
      const res = await fetch(`/api/admin/consignment-stores/${storeId}/owner`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerProfileId }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(json.error ?? "Could not transfer ownership")
        return
      }
      toast.success("Store ownership transferred")
      await refresh()
    } catch {
      toast.error("Could not transfer ownership")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      {operatorsWithoutStore.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
          <p className="font-medium">Granted operators without a store</p>
          <ul className="mt-2 space-y-1">
            {operatorsWithoutStore.map((o) => (
              <li key={o.profileId}>
                {[o.displayName, o.email].filter(Boolean).join(" · ") || o.profileId}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-amber-900/80">
            Granting the role alone does not create a store. Create one below, or transfer an
            existing store to them.
          </p>
        </div>
      ) : null}

      <form
        onSubmit={handleCreateStore}
        className="rounded-lg border bg-card p-4 space-y-4"
      >
        <div>
          <h2 className="text-sm font-semibold">Create consignment store</h2>
          <p className="text-xs text-muted-foreground mt-1">
            The operator must already have the consignment-shop role in Users.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="create-owner">Owner</Label>
            <Select value={createOwnerId} onValueChange={setCreateOwnerId}>
              <SelectTrigger id="create-owner">
                <SelectValue placeholder="Select granted operator" />
              </SelectTrigger>
              <SelectContent>
                {operatorOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id} disabled={o.hasStore}>
                    {o.label}
                    {o.hasStore ? " (already has store)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-slug">URL slug</Label>
            <Input
              id="create-slug"
              value={createSlug}
              onChange={(e) => setCreateSlug(e.target.value)}
              placeholder="reswell-flagship"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-name">Store name</Label>
            <Input
              id="create-name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Reswell Flagship Store"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-commission">Default commission (%)</Label>
            <Input
              id="create-commission"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={createCommissionPct}
              onChange={(e) => setCreateCommissionPct(e.target.value)}
            />
          </div>
        </div>
        <Button type="submit" disabled={busy === "create" || operators.length === 0}>
          {busy === "create" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Create store
        </Button>
      </form>

      {stores.map((store) => (
        <div key={store.id} className="rounded-lg border p-4 space-y-3">
          <div>
            <p className="font-medium">{store.name}</p>
            <p className="text-xs text-muted-foreground">/{store.slug}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-2">
              <Label>Transfer ownership to</Label>
              <Select
                onValueChange={(profileId) => void handleTransfer(store.id, profileId)}
                disabled={busy === `transfer-${store.id}`}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select granted operator" />
                </SelectTrigger>
                <SelectContent>
                  {operatorOptions
                    .filter((o) => o.id !== store.ownerProfileId)
                    .map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {busy === `transfer-${store.id}` ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
