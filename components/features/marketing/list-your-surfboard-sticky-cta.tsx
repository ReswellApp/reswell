"use client"

import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"
import { ListYourSurfboardSellCta } from "@/components/features/marketing/list-your-surfboard-sell-cta"

type ListYourSurfboardStickyCtaProps = {
  userId: string | null
}

/**
 * Mobile-only sticky conversion bar. Stays out of the way until the hero CTA
 * scrolls off-screen, then keeps the primary action one tap away. Hidden on
 * desktop (`lg:hidden`) where the inline CTAs are always reachable.
 */
export function ListYourSurfboardStickyCta({ userId }: ListYourSurfboardStickyCtaProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 520)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 transform-gpu transition-transform duration-300 ease-out lg:hidden",
        visible ? "translate-y-0" : "translate-y-full",
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-hidden={!visible}
    >
      <div className="border-t border-foreground/10 bg-white/95 px-4 pb-3 pt-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.25)] backdrop-blur">
        <ListYourSurfboardSellCta
          userId={userId}
          className="w-full"
          tabIndex={visible ? undefined : -1}
        >
          List your surfboard — it&apos;s free
        </ListYourSurfboardSellCta>
      </div>
    </div>
  )
}
