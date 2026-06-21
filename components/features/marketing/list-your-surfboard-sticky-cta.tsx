"use client"

import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"
import { ListYourSurfboardSellCta } from "@/components/features/marketing/list-your-surfboard-sell-cta"

type ListYourSurfboardStickyCtaProps = {
  userId?: string | null
  /** Always show at the bottom on mobile (list-your-surfboard one-screen fold). */
  pinned?: boolean
}

export function ListYourSurfboardStickyCta({
  userId,
  pinned = false,
}: ListYourSurfboardStickyCtaProps) {
  const [visible, setVisible] = useState(pinned)

  useEffect(() => {
    if (pinned) return
    const onScroll = () => setVisible(window.scrollY > 520)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [pinned])

  const showBar = pinned || visible

  return (
    <div
      id="listyoursurfboard-sticky-cta"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 transform-gpu transition-transform duration-300 ease-out lg:hidden",
        showBar ? "translate-y-0" : "translate-y-full",
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-hidden={!showBar}
    >
      <div className="border-t border-border/60 bg-background px-4 pb-3 pt-3 shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.12)]">
        <ListYourSurfboardSellCta
          userId={userId}
          className="w-full"
          tabIndex={showBar ? undefined : -1}
        >
          List your surfboard
        </ListYourSurfboardSellCta>
      </div>
    </div>
  )
}
