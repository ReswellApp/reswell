"use client"

import { cn } from "@/lib/utils"

export type ProfileSettingsTabId = "shop" | "sign-in" | "addresses" | "notifications"
export type ProfileSettingsVariant = "dashboard" | "threads"

interface ProfileSettingsTabNavProps {
  activeTab: ProfileSettingsTabId
  onTabChange: (tab: ProfileSettingsTabId) => void
  variant?: ProfileSettingsVariant
  labels: {
    shop: string
    signIn: string
    addresses: string
    notifications: string
  }
}

const TAB_ORDER: ProfileSettingsTabId[] = ["shop", "sign-in", "addresses", "notifications"]

export function ProfileSettingsTabNav({
  activeTab,
  onTabChange,
  variant = "dashboard",
  labels,
}: ProfileSettingsTabNavProps) {
  const isThreads = variant === "threads"
  const labelByTab: Record<ProfileSettingsTabId, string> = {
    shop: labels.shop,
    "sign-in": labels.signIn,
    addresses: labels.addresses,
    notifications: labels.notifications,
  }

  return (
    <nav
      className={cn(
        "flex gap-6 overflow-x-auto pb-0 sm:gap-8",
        isThreads ? "border-b border-[#355185]/15" : "border-b border-neutral-200/80",
      )}
      aria-label="Profile settings"
    >
      {TAB_ORDER.map((tab) => {
        const active = activeTab === tab
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={cn(
              "relative shrink-0 pb-3 text-sm font-medium transition-colors",
              active
                ? isThreads
                  ? "text-[#355185]"
                  : "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            {labelByTab[tab]}
            {active ? (
              <span
                className={cn(
                  "absolute inset-x-0 -bottom-px h-0.5 rounded-full",
                  isThreads ? "bg-[#5574AD]" : "bg-primary",
                )}
              />
            ) : null}
          </button>
        )
      })}
    </nav>
  )
}

export function profileSettingsTabFromHash(hash: string): ProfileSettingsTabId {
  const raw = hash.replace(/^#/, "").trim()
  if (raw === "addresses") return "addresses"
  if (raw === "sign-in" || raw === "signin") return "sign-in"
  if (raw === "notifications") return "notifications"
  if (raw === "profile" || raw === "shop") return "shop"
  return "shop"
}

export function profileSettingsHashForTab(tab: ProfileSettingsTabId): string | null {
  if (tab === "shop") return null
  return tab
}
