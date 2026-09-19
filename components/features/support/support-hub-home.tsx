"use client"

import type { SupportHubCategory, SupportHubCategoryId } from "@/lib/help/help-hub-intents"
import type { UserSupportCaseListItem } from "@/lib/types/supportCase"
import { isSupportCaseOpen } from "@/lib/utils/support-case-display"
import {
  isOpenSupportCaseLimitReached,
  MAX_OPEN_USER_SUPPORT_CASES,
} from "@/lib/utils/support-case-open-limit"
import { SupportCasesList } from "@/components/features/dashboard/support/support-cases-list"
import { SupportCurrentRequest } from "@/components/features/dashboard/support/support-current-request"
import {
  SupportHubActionButton,
  SupportHubActionDrawer,
  SupportHubActionGroup,
  SupportHubActionLink,
} from "@/components/features/support/support-hub-action-row"
import { SupportHubCategoryGrid } from "@/components/features/support/support-hub-category-grid"
import { SupportHubSearch } from "@/components/features/support/support-hub-search"

interface SupportHubHomeProps {
  cases: UserSupportCaseListItem[]
  categories: readonly SupportHubCategory[]
  featuredId?: SupportHubCategoryId | null
  query: string
  onQueryChange: (value: string) => void
  onPick: (category: SupportHubCategory) => void
  onTalkToTeam: () => void
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
  onTalkToTeam,
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
  const atLimit = signedIn && isOpenSupportCaseLimitReached(openCases.length)
  const collapseNewRequest = Boolean(signedIn && current && !atLimit)

  const newRequestSection = (
    <div className="space-y-4">
      <SupportHubSearch value={query} onChange={onQueryChange} />
      <SupportHubCategoryGrid
        categories={categories}
        featuredId={featuredId}
        onPick={onPick}
      />
    </div>
  )

  const morePanel = (
    <SupportHubActionGroup>
      {atLimit ? (
        <p className="px-4 py-3.5 text-[13px] leading-relaxed text-muted-foreground">
          You have {MAX_OPEN_USER_SUPPORT_CASES} open requests — the most we can work at once.
          Reply on one of those threads, or wait until one is closed, to start another.
        </p>
      ) : collapseNewRequest ? (
        <SupportHubActionDrawer
          title="Open another request"
          defaultOpen={query.trim().length > 0}
        >
          {newRequestSection}
        </SupportHubActionDrawer>
      ) : null}
      {atLimit ? null : (
        <SupportHubActionButton onClick={onTalkToTeam}>
          Talk to the team now
        </SupportHubActionButton>
      )}
      <SupportHubActionLink href="/faq">Browse FAQs</SupportHubActionLink>
      {signedIn && hasHistory ? (
        <SupportCasesList cases={cases} historyOpen={historyOpen} showCurrent={false} />
      ) : null}
    </SupportHubActionGroup>
  )

  return (
    <div className="space-y-6">
      {signedIn && current ? <SupportCurrentRequest item={current} /> : null}
      {collapseNewRequest || atLimit ? null : newRequestSection}
      {morePanel}
    </div>
  )
}
