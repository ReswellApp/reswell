"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

export function CartHeaderLink({ showOnNarrowScreens = false }: { showOnNarrowScreens?: boolean }) {
  const [count, setCount] = useState<number | null>(null)
  const visibility = showOnNarrowScreens ? "inline-flex" : "hidden sm:inline-flex"

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setCount(0)
        return
      }
      const { count: n, error } = await supabase
        .from("cart_items")
        .select("*", { count: "exact", head: true })
        .eq("profile_id", user.id)
      if (error) {
        setCount(0)
        return
      }
      setCount(n ?? 0)
    }

    void load()

    function onCartUpdated() {
      void load()
    }
    window.addEventListener("cartUpdated", onCartUpdated)
    return () => window.removeEventListener("cartUpdated", onCartUpdated)
  }, [])

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
