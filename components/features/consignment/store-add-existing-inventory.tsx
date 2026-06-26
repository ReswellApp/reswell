"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import Image from "next/image"
import { toast } from "sonner"
import { attachListingToShopInventory } from "@/lib/utils/attach-shop-listing-client"

export type UnattachedOwnerListing = {
  listingId: string
  title: string
  price: number
  coverUrl: string | null
  section: string | null
}

interface StoreAddExistingInventoryProps {
  storeSlug: string
  listings: UnattachedOwnerListing[]
}

export function StoreAddExistingInventory({ storeSlug, listings }: StoreAddExistingInventoryProps) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  if (listings.length === 0) return null

  async function attach(listingId: string) {
    setBusyId(listingId)
    try {
      const result = await attachListingToShopInventory(listingId, storeSlug)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Added to shop inventory")
      startTransition(() => router.refresh())
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mb-8 rounded-lg border border-dashed p-4">
      <p className="text-sm font-medium">Add from your seller profile</p>
      <p className="mt-1 text-xs text-muted-foreground">
        These listings are live on your account but not yet on your shop floor.
      </p>
      <ul className="mt-3 divide-y rounded-md border">
        {listings.map((item) => (
          <li key={item.listingId} className="flex items-center gap-3 px-3 py-2.5">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
              {item.coverUrl ? (
                <Image
                  src={item.coverUrl}
                  alt={item.title}
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{item.title}</p>
              {item.section ? (
                <p className="text-xs capitalize text-muted-foreground">{item.section}</p>
              ) : null}
            </div>
            <p className="shrink-0 text-sm tabular-nums">${item.price.toFixed(2)}</p>
            <button
              type="button"
              disabled={busyId === item.listingId}
              onClick={() => void attach(item.listingId)}
              className="shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-50"
            >
              {busyId === item.listingId ? "Adding…" : "Add"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
