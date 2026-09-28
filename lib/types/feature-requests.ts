export const FEATURE_REQUEST_KINDS = ["feature", "bug"] as const
export type FeatureRequestKind = (typeof FEATURE_REQUEST_KINDS)[number]

export const FEATURE_REQUEST_STATUSES = [
  "idea",
  "under_review",
  "planned",
  "in_progress",
  "shipped",
  "closed",
] as const
export type FeatureRequestStatus = (typeof FEATURE_REQUEST_STATUSES)[number]

export const FEATURE_REQUEST_OPEN_STATUSES = [
  "idea",
  "under_review",
  "planned",
  "in_progress",
] as const

export const FEATURE_REQUEST_STATUS_FILTERS = ["open", "all", ...FEATURE_REQUEST_STATUSES] as const
export type FeatureRequestStatusFilter = (typeof FEATURE_REQUEST_STATUS_FILTERS)[number]

export const FEATURE_REQUEST_SORTS = ["top", "new", "comments"] as const
export type FeatureRequestSort = (typeof FEATURE_REQUEST_SORTS)[number]

export const FEATURE_REQUEST_KIND_FILTERS = ["all", "feature", "bug"] as const
export type FeatureRequestKindFilter = (typeof FEATURE_REQUEST_KIND_FILTERS)[number]

export const FEATURE_REQUEST_TAGS = [
  "buying",
  "selling",
  "app",
  "web",
  "offers",
  "shipping",
  "search",
] as const
export type FeatureRequestTag = (typeof FEATURE_REQUEST_TAGS)[number]

export const FEATURE_REQUEST_PAGE_SIZE = 20

export type FeatureRequestBoardQuery = {
  status: FeatureRequestStatusFilter
  sort: FeatureRequestSort
  kind: FeatureRequestKindFilter
  q: string
  page: number
}

export type FeatureRequestAuthor = {
  id: string
  displayName: string | null
  avatarUrl: string | null
}

export type FeatureRequestListItem = {
  id: string
  number: number
  kind: FeatureRequestKind
  title: string
  body: string
  status: FeatureRequestStatus
  tags: FeatureRequestTag[]
  estimatedLabel: string | null
  voteCount: number
  commentCount: number
  createdAt: string
  author: FeatureRequestAuthor
  votedByViewer: boolean
}

export type FeatureRequestCommentItem = {
  id: string
  body: string
  createdAt: string
  author: FeatureRequestAuthor
  canDelete: boolean
}

export type FeatureRequestChangelogEntry = {
  id: string
  title: string
  body: string
  publishedAt: string
  requestNumber: number | null
}

export type FeatureRequestDetail = FeatureRequestListItem & {
  comments: FeatureRequestCommentItem[]
  commentsTruncated: boolean
  changelog: FeatureRequestChangelogEntry | null
}

export type FeatureRequestViewer = {
  id: string
  isStaff: boolean
} | null

export type FeatureRequestBoard = {
  query: FeatureRequestBoardQuery
  requests: FeatureRequestListItem[]
  total: number
  viewer: FeatureRequestViewer
  degraded: boolean
}

export type FeatureRequestChangelogBoard = {
  entries: FeatureRequestChangelogEntry[]
  viewer: FeatureRequestViewer
  degraded: boolean
}
