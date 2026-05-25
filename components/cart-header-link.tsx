"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

const CART_LOAD_TIMEOUT_MS = 8_000

function withTimeout<T>(promise: PromiseLike<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), ms)
    }),
  ])
}

export function CartHeaderLink({
  showOnNarrowScreens = false,
  /** Primary cart control in the desktop (`lg+`) main nav row. */
  showOnDesktopNav = false,
  /** Header auth snapshot resolved — guests can show cart without another `getUser()`. */
  authResolved = false,
  /** When set (including `null` for guests), skips `auth.getUser()` in the nav. */
  userId,
}: {
  showOnNarrowScreens?: boolean
  showOnDesktopNav?: boolean
  authResolved?: boolean
  userId?: string | null
}) {
  const [count, setCount] = useState<number | null>(null)
  const visibility = showOnNarrowScreens
    ? "inline-flex"
    : showOnDesktopNav
      ? "hidden lg:inline-flex"
      : "hidden sm:inline-flex lg:hidden"

  useEffect(() => {
    if (authResolved && userId === null) {
      setCount(0)
      return
    }

    let cancelled = false
    const supabase = createClient()

    async function load() {
      let resolvedUserId = userId
      if (resolvedUserId === undefined) {
        const { data } = await withTimeout(
          supabase.auth.getSession(),
          CART_LOAD_TIMEOUT_MS,
          { data: { session: null } },
        )
        resolvedUserId = data.session?.user?.id ?? null
      }

      if (!resolvedUserId) {
        if (!cancelled) setCount(0)
        return
      }

      const { count: n, error } = await withTimeout(
        supabase
          .from("cart_items")
          .select("*", { count: "exact", head: true })
          .eq("profile_id", resolvedUserId),
        CART_LOAD_TIMEOUT_MS,
        { count: 0, error: null },
      )

      if (!cancelled) setCount(error ? 0 : (n ?? 0))
    }

    void load()

    function onCartUpdated() {
      void load()
    }
    window.addEventListener("cartUpdated", onCartUpdated)
    return () => {
      cancelled = true
      window.removeEventListener("cartUpdated", onCartUpdated)
    }
  }, [authResolved, userId])

  if (count === null) {
    return (
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center", visibility)} aria-hidden>
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>
    )
  }

  return (
    <Link href="/cart" className={cn("relative", visibility)}>
      <Button variant="ghost" size="icon" className="h-10 w-10 text-foreground hover:bg-pacific/5">
        <ShoppingCart className="h-6 w-6" />
        {count > 0 && (
          <Badge
            variant="secondary"
            className="absolute -right-1 -top-1 h-5 min-w-[1.25rem] rounded-full px-1 text-xs flex items-center justify-center"
          >
            {count > 9 ? "9+" : count}
          </Badge>
        )}
        <span className="sr-only">Cart{count > 0 ? `, ${count} items` : ""}</span>
      </Button>
    </Link>
  )
}
