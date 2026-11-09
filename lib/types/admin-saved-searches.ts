export interface AdminSavedSearchAccount {
  id: string
  email: string | null
  displayName: string | null
}

export interface AdminSavedSearchRow {
  id: string
  label: string | null
  summary: string
  criteriaJson: string
  sectionLabel: string
  alertKindLabel: string
  sourceLabel: string
  emailEnabled: boolean
  browseHref: string
  alertsSent: number
  createdAt: string
  updatedAt: string
  account: AdminSavedSearchAccount
}

export interface AdminSavedSearchStats {
  total: number
  alerts: number
  savedOnly: number
  uniqueAccounts: number
  uniqueAccountsCapped: boolean
}

export interface AdminSavedSearchPage {
  rows: AdminSavedSearchRow[]
  page: number
  pageSize: number
  total: number
  query: string
  kind: "all" | "alerts" | "saved"
  section: string
  userMatchTruncated: boolean
  stats: AdminSavedSearchStats
}
