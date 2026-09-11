"use client"

import Link from "next/link"
import type { SupportHubCategory, SupportHubCategoryId } from "@/lib/help/help-hub-intents"
import type { UserSupportCaseListItem } from "@/lib/types/supportCase"
import { isSupportCaseOpen } from "@/lib/utils/support-case-display"
import {
  isOpenSupportCaseLimitReached,
  MAX_OPEN_USER_SUPPORT_CASES,
} from "@/lib/utils/support-case-open-limit"
import { SupportCasesList } from "@/components/features/dashboard/support/support-cases-list"
import { SupportCurrentRequest } from "@/components/features/dashboard/support/support-current-request"
import { SupportHubCategoryGrid } from "@/components/features/support/support-hub-category-grid"
import { SupportHubSearch } from "@/components/features/support/support-hub-search"

interface SupportHubHomeProps {
  cases: UserSupportCaseListItem[]
  categories: readonly SupportHubCategory[]
  featuredId?: SupportHubCategoryId | null
  query: string
  onQueryChange: (value: string) => void
  onPick: (category: SupportHubCategory) => void
  historyOpen?: boolean
  signedIn: boolean
}

export function SupportHubHome({
  cases,
  categories,
  featuredId = null,
  query,
  onQueryChange,
  onPick,
  historyOpen = false,
  signedIn,
}: SupportHubHomeProps) {
  const openCases = cases.filter((item) => isSupportCaseOpen(item.status))
  const current =
    openCases.find((item) => item.unreadCount > 0) ??
    openCases.find((item) => item.status === "waiting_on_you") ??
    openCases[0] ??
    null
  const hasHistory = cases.some((item) => item.id !== current?.id)

  return (
    <div className="space-y-6">
      <SupportHubSearch value={query} onChange={onQueryChange} />

      {signedIn && current ? <SupportCurrentRequest item={current} /> : null}

      {signedIn && isOpenSupportCaseLimitReached(openCases.length) ? (
        <p className="rounded-2xl border border-listingHeart/25 bg-listingHeart/[0.04] px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
          You have {MAX_OPEN_USER_SUPPORT_CASES} open requests — the most we can work at once.
          Reply on one of those threads, or wait until one is closed, to start another.
        </p>
      ) : null}

      <SupportHubCategoryGrid
        categories={categories}
        featuredId={featuredId}
        onPick={onPick}
      />
      <Link
        href="/faq"
        className="flex h-12 w-full items-center justify-center rounded-full bg-listingHeart text-[15px] font-medium text-white shadow-sm transition-colors hover:bg-listingHeart/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-listingHeart focus-visible:ring-offset-2"
      >
        Frequently Asked Questions
      </Link>

      {signedIn && hasHistory ? (
        <SupportCasesList cases={cases} historyOpen={historyOpen} showCurrent={false} />
      ) : null}
    </div>
  )
}
