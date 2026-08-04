export type BrowseButtonAnalyticsSummary = {
  totalClicks: number
  shipToMeClicks: number
  filterClicks: number
  facetClicks: number
  uniqueUsers: number
}

export type BrowseButtonShipToMeStats = {
  total: number
  enabled: number
  disabled: number
  uniqueUsers: number
  dailyTrend: { date: string; count: number }[]
}

export type BrowseButtonFilterCategoryRow = {
  category: string
  count: number
  uniqueUsers: number
  mobile: number
  desktop: number
}

export type BrowseButtonFacetCategoryRow = {
  category: string
  facetKey: string
  facetValue: string
  count: number
  selectCount: number
  deselectCount: number
  setCount: number
  uniqueUsers: number
}

export type BrowseButtonDailyTrendRow = {
  date: string
  shipToMe: number
  filter: number
  facet: number
}

export type BrowseButtonRecentEventRow = {
  id: string
  createdAt: string
  userId: string | null
  category: string
  button: string
  detail: string | null
  facetKey: string | null
  facetValue: string | null
}

export type BrowseButtonAnalyticsDashboard = {
  days: number
  summary: BrowseButtonAnalyticsSummary
  shipToMe: BrowseButtonShipToMeStats
  filterByCategory: BrowseButtonFilterCategoryRow[]
  facetsByCategory: BrowseButtonFacetCategoryRow[]
  dailyTrend: BrowseButtonDailyTrendRow[]
  recentEvents: BrowseButtonRecentEventRow[]
}
