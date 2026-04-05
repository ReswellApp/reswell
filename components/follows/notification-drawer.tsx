"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Bell, ExternalLink, Package } from "lucide-react"
import { cn } from "@/lib/utils"
import type { FollowNotification } from "@/lib/follows/types"

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return "Yesterday"
  return `${days}d ago`
}

function getListingHref(listing: FollowNotification["listing"]): string {
  if (!listing) return "/"
  const id = listing.slug || listing.id
  if (listing.section === "surfboards") return `/boards/${id}`
  if (listing.section === "new") return `/shop/${listing.id}`
  return `/${id}`
}

export function NotificationDrawer() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<FollowNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/follows/notifications?limit=1")
      if (!res.ok) return
      const data = await res.json()
      setUnreadCount(data.unreadCount ?? 0)
    } catch {
      // silently ignore
    }
  }, [])

  useEffect(() => {
    fetchUnreadCount()
    // Refresh when other parts of the app trigger unreadCountRefresh
    window.addEventListener("unreadCountRefresh", fetchUnreadCount)
    return () => window.removeEventListener("unreadCountRefresh", fetchUnreadCount)
  }, [fetchUnreadCount])

  async function onOpen() {
    setLoading(true)
    try {
      const res = await fetch("/api/follows/notifications?limit=30&unreadOnly=false")
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications ?? [])
      setUnreadCount(data.unreadCount ?? 0)
    } finally {
      setLoading(false)
    }

    // Mark all as read
    await fetch("/api/follows/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    setUnreadCount(0)
    window.dispatchEvent(new Event("unreadCountRefresh"))
  }

  async function handleNotificationClick(id: string) {
    // Mark individual as read
    await fetch("/api/follows/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    })
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) onOpen()
      }}
    >
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-11 w-11 text-black hover:bg-pacific/5"
          aria-label="Follow notifications"
        >
          <Bell className="h-6 w-6" />
          {unreadCount > 0 && (
            <Badge className="absolute -right-1 -top-1 h-5 min-w-[1.25rem] rounded-full px-1 text-xs flex items-center justify-center bg-red-500 text-white hover:bg-red-600 pointer-events-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:w-[400px] p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b border-border">
          <SheetTitle className="text-base font-semibold">Seller notifications</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              Loading…
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <Package className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium text-foreground">No notifications yet</p>
              <p className="text-sm text-muted-foreground max-w-[220px]">
                Follow sellers to get notified when they post new listings.
              </p>
              <Button variant="outline" size="sm" asChild onClick={() => setOpen(false)}>
                <Link href="/following">Browse sellers</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((n) => {
                const actorName =
                  n.actor?.shop_name || n.actor?.display_name || "A seller"
                const listing = n.listing
                const primaryImg =
                  listing?.listing_images?.find((i) => i.is_primary) ||
                  listing?.listing_images?.[0]
                const href = getListingHref(listing)
                const isPriceDrop = n.type === "price_drop_from_followed"

                return (
                  <li
                    key={n.id}
                    className={cn(
                      "flex gap-3 px-5 py-4 transition-colors",
                      !n.is_read && "bg-blue-50/50 dark:bg-blue-950/20"
                    )}
                  >
                    {/* Seller avatar */}
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={n.actor?.avatar_url || ""} alt={actorName} />
                      <AvatarFallback className="text-sm font-semibold bg-primary text-primary-foreground">
                        {actorName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug">
                        <span className="font-semibold">{actorName}</span>
                        {n.actor?.city && (
                          <span className="text-muted-foreground"> · {n.actor.city}</span>
                        )}
                        {isPriceDrop ? " dropped the price on" : " listed"}
                        {listing && (
                          <>
                            {" "}
                            <Link
                              href={href}
                              className="font-medium text-foreground hover:underline"
                              onClick={() => {
                                handleNotificationClick(n.id)
                                setOpen(false)
                              }}
                            >
                              {listing.title}
                            </Link>
                          </>
                        )}
                      </p>
                      {listing && (
                        <p className="text-sm font-semibold text-foreground mt-0.5">
                          ${Number(listing.price).toFixed(2)}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>

                    {/* Listing thumbnail */}
                    {primaryImg?.url && (
                      <Link
                        href={href}
                        className="relative h-14 w-14 shrink-0 rounded-md overflow-hidden bg-muted block"
                        onClick={() => {
                          handleNotificationClick(n.id)
                          setOpen(false)
                        }}
                      >
                        <Image
                          src={primaryImg.url}
                          alt={listing?.title || ""}
                          fill
                          className="object-cover"
                          sizes="56px"
                        />
                      </Link>
                    )}

                    {/* View button (fallback when no image) */}
                    {!primaryImg?.url && listing && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="shrink-0 self-start"
                      >
                        <Link
                          href={href}
                          onClick={() => {
                            handleNotificationClick(n.id)
                            setOpen(false)
                          }}
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1" />
                          View
                        </Link>
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => setOpen(false)}
            asChild
          >
            <Link href="/dashboard/following">Manage following</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => setOpen(false)}
            asChild
          >
            <Link href="/following">View feed</Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
