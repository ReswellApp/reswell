"use client"

import Image from "next/image"
import Link from "next/link"
import { Loader2, MapPin, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { VerifiedBadge } from "@/components/verified-badge"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"
import { cn } from "@/lib/utils"
import type { FacebookMarketplaceBulkSellerHit } from "@/lib/services/facebookMarketplaceBulkExport"

function sellerLabel(shopName: string | null | undefined, displayName: string | null | undefined): string {
  return shopName?.trim() || displayName?.trim() || "Seller"
}

type FacebookMarketplaceSellerSearchPanelProps = {
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  searching: boolean
  searchHits: FacebookMarketplaceBulkSellerHit[]
  selectedSellerId: string | null
  onSelectSeller: (sellerId: string) => void
}

export function FacebookMarketplaceSellerSearchPanel({
  searchQuery,
  onSearchQueryChange,
  searching,
  searchHits,
  selectedSellerId,
  onSelectSeller,
}: FacebookMarketplaceSellerSearchPanelProps) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-foreground">1. Choose a seller</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Search the same sellers you’d find on{" "}
        <Link href="/sellers" className="underline underline-offset-2">
          /sellers
        </Link>
        .
      </p>
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Search by shop, name, slug, or city…"
          className="pl-9"
          aria-label="Search sellers"
        />
      </div>
      {searchQuery.trim().length > 0 ? (
        <div className="mt-3 max-h-72 overflow-y-auto rounded-md border border-border/60">
          {searching && searchHits.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : searchHits.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">No sellers match that search.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {searchHits.map((hit) => {
                const label = sellerLabel(hit.shop_name, hit.display_name)
                const loc = hit.shop_address?.trim() || hit.city?.trim() || null
                const avatarRaw = hit.shop_logo_url || hit.avatar_url || null
                const avatar = avatarRaw ? profileMediaDisplaySrc(avatarRaw) : null
                const selected = selectedSellerId === hit.id
                return (
                  <li key={hit.id}>
                    <button
                      type="button"
                      onClick={() => onSelectSeller(hit.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40",
                        selected && "bg-muted/50",
                      )}
                    >
                      {avatar ? (
                        <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border/50 bg-background">
                          <Image
                            src={avatar}
                            alt=""
                            fill
                            sizes="40px"
                            className="object-cover"
                            unoptimized={listingImageShouldBypassOptimization(avatar)}
                          />
                        </span>
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/50 bg-muted text-sm font-semibold text-cerulean">
                          {label.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                          <span className="truncate">{label}</span>
                          {hit.shop_verified ? <VerifiedBadge size="sm" /> : null}
                        </span>
                        {loc ? (
                          <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                            <span className="truncate">{loc}</span>
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {hit.active_listing_count} active
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  )
}
