"use client"

import { useEffect, useRef, useState } from "react"
import {
  MODEL_PAGE_TABS,
  modelPageSectionId,
  parseModelPageTab,
  type ModelPageTab,
} from "@/lib/models/routes"
import { cn } from "@/lib/utils"

const TAB_ITEMS: { id: ModelPageTab; label: (reviewCount: number) => string }[] = [
  { id: "listings", label: () => "Listings" },
  { id: "details", label: () => "Product details" },
  { id: "price-guide", label: () => "Price guide" },
  { id: "reviews", label: (count) => (count > 0 ? `Reviews (${count})` : "Reviews") },
]

function headerOffsetPx(): number {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--site-header-height")
    .trim()
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : 64
}

function sectionFromLocation(): ModelPageTab {
  const queryTab = new URLSearchParams(window.location.search).get("tab")
  if (queryTab) return parseModelPageTab(queryTab)
  return parseModelPageTab(window.location.hash)
}

function sectionAtOffset(offset: number): ModelPageTab {
  let current: ModelPageTab = "listings"
  for (const tab of MODEL_PAGE_TABS) {
    const el = document.getElementById(modelPageSectionId(tab))
    if (!el) continue
    if (el.getBoundingClientRect().top <= offset + 16) current = tab
  }
  return current
}

export function ModelPageTabs({ reviewCount }: { reviewCount: number }) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const [activeTab, setActiveTab] = useState<ModelPageTab>("listings")
  const [stuck, setStuck] = useState(false)
  const [navHeight, setNavHeight] = useState(52)

  useEffect(() => {
    const initial = sectionFromLocation()
    setActiveTab(initial)
    const target = document.getElementById(modelPageSectionId(initial))
    if (target && (window.location.hash || new URLSearchParams(window.location.search).get("tab"))) {
      target.scrollIntoView({ behavior: "smooth", block: "start" })
    }

    const sentinel = sentinelRef.current
    const nav = navRef.current
    if (nav) setNavHeight(nav.offsetHeight)

    const stickObserver =
      sentinel &&
      new IntersectionObserver(
        ([entry]) => {
          setStuck(!entry.isIntersecting)
          if (nav) setNavHeight(nav.offsetHeight)
        },
        { rootMargin: `-${headerOffsetPx()}px 0px 0px 0px`, threshold: 0 },
      )
    if (sentinel && stickObserver) stickObserver.observe(sentinel)

    let frame = 0
    const syncActive = () => {
      frame = 0
      const offset = headerOffsetPx() + (navRef.current?.offsetHeight ?? navHeight)
      setActiveTab(sectionAtOffset(offset))
    }
    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(syncActive)
    }
    const onHash = () => setActiveTab(parseModelPageTab(window.location.hash))

    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("hashchange", onHash)
    syncActive()

    return () => {
      stickObserver?.disconnect()
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("hashchange", onHash)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <>
      <div ref={sentinelRef} aria-hidden className="h-px w-full" />
      {stuck ? <div aria-hidden style={{ height: navHeight }} /> : null}
      <nav
        ref={navRef}
        aria-label="Model page sections"
        className={cn(
          "z-40 border-b border-border/80 bg-background/95 backdrop-blur",
          stuck
            ? "fixed inset-x-0"
            : "-mx-4 px-4 sm:-mx-6 sm:px-6",
        )}
        style={stuck ? { top: "var(--site-header-height, 4rem)" } : undefined}
      >
        <ul className={cn("flex flex-wrap gap-x-6 gap-y-1", stuck && "mx-auto max-w-6xl px-4 sm:px-6")}>
          {TAB_ITEMS.map((tab) => {
            const href = `#${modelPageSectionId(tab.id)}`
            const active = tab.id === activeTab
            return (
              <li key={tab.id}>
                <a
                  href={href}
                  aria-current={active ? "location" : undefined}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "-mb-px inline-flex border-b-2 py-3 text-sm font-medium transition-colors",
                    active
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label(reviewCount)}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
