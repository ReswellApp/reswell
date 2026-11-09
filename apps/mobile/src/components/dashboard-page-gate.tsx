import type { ReactNode } from "react"
import { useCallback } from "react"
import type { MobileDashboard, MobileDashboardPageId } from "@reswell/api-contract"
import { AccountState } from "@/components/account-state"
import { fetchDashboard } from "@/lib/api"
import { useAccountResource } from "@/lib/use-account-resource"

/** Renders a dashboard destination only when the account API includes that page. */
export function DashboardPageGate({
  id,
  title,
  onBack,
  children,
}: {
  id: MobileDashboardPageId
  title: string
  onBack?: () => void
  children: (dashboard: MobileDashboard) => ReactNode
}) {
  const loadDashboard = useCallback((accessToken: string) => fetchDashboard(accessToken), [])
  const { data, error, loading, reload } = useAccountResource(loadDashboard)
  const allowed = data?.pages.some((page) => page.id === id) ?? false

  return (
    <AccountState
      title={title}
      onBack={onBack}
      loading={loading}
      error={error}
      onRetry={reload}
      empty="This page is not available for your account."
      isEmpty={!allowed}
    >
      {data && allowed ? children(data) : null}
    </AccountState>
  )
}
