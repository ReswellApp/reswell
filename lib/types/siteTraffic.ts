export type SiteTrafficWindowStats = {
  pageViews: number
  uniqueVisitors: number
}

export type SiteTrafficMonthRow = {
  monthStart: string
  monthLabel: string
  pageViews: number
  uniqueVisitors: number
}

export type SiteTrafficDashboardRow = {
  last7Days: SiteTrafficWindowStats
  last30Days: SiteTrafficWindowStats
  byMonth: SiteTrafficMonthRow[]
}
