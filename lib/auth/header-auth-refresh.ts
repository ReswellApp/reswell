/** Dispatched after sign-in or profile updates so the shell refreshes without `router.refresh()`. */
export const HEADER_AUTH_REFRESH_EVENT = "reswell:auth-refresh" as const

export type HeaderAuthRefreshDetail = {
  displayName?: string | null
  avatarUrl?: string | null
  /** Reconciled wallet total (ready + pending); matches earnings Balance card. */
  walletTotalBalance?: number
}

export function dispatchHeaderAuthRefresh(detail?: HeaderAuthRefreshDetail): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent<HeaderAuthRefreshDetail>(HEADER_AUTH_REFRESH_EVENT, { detail }),
  )
}
