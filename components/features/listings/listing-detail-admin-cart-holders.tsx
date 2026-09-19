"use client"

import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { ShoppingCart } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  listingAdminBarCartHoldersLabel,
  type ListingAdminCartHolder,
} from "@/lib/listing-detail-admin-bar"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"
import { cn } from "@/lib/utils"

function holderInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "M"
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase()
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase()
}

function addedAgo(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "In cart"
  return `Added ${formatDistanceToNow(date, { addSuffix: true })}`
}

export function ListingDetailAdminCartHolders({
  holders,
  actionClass,
}: {
  holders: ListingAdminCartHolder[]
  actionClass: string
}) {
  const count = holders.length
  const label = listingAdminBarCartHoldersLabel(count)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={cn(actionClass, count > 0 && "border-sky-400 bg-sky-100 dark:bg-sky-900")}
          aria-label={
            count > 0
              ? `${label}. View buyers who have this listing in their cart`
              : "No one has this listing in their cart"
          }
        >
          <ShoppingCart />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3 p-3">
        <div>
          <p className="text-sm font-medium">In cart</p>
          <p className="text-xs text-muted-foreground">
            Members who currently have this listing in their cart. Only admins can see this.
          </p>
        </div>
        {count === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No one has this listing in their cart right now.
          </p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {holders.map((holder) => {
              const avatarSrc = profileMediaDisplaySrc(holder.avatarUrl)
              const qtyLabel = holder.quantity > 1 ? ` · qty ${holder.quantity}` : ""
              return (
                <li key={holder.userId}>
                  <Link
                    href={`/admin/users/${holder.userId}`}
                    className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card px-2.5 py-2 transition-colors hover:bg-muted/70"
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      {avatarSrc ? <AvatarImage src={avatarSrc} alt="" /> : null}
                      <AvatarFallback className="text-[10px]">
                        {holderInitials(holder.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {holder.displayName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {holder.email
                          ? `${holder.email} · ${addedAgo(holder.addedAt)}`
                          : addedAgo(holder.addedAt)}
                        {qtyLabel}
                      </p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
