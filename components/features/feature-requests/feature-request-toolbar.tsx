import Link from "next/link"
import {
  FEATURE_REQUEST_KIND_FILTERS,
  FEATURE_REQUEST_SORTS,
  FEATURE_REQUEST_STATUS_FILTERS,
  type FeatureRequestBoardQuery,
} from "@/lib/types/feature-requests"
import {
  FEATURE_REQUEST_KIND_FILTER_LABEL,
  FEATURE_REQUEST_SORT_LABEL,
  FEATURE_REQUEST_STATUS_FILTER_LABEL,
  FEATURE_REQUESTS_PATH,
  featureRequestBoardHref,
} from "@/lib/utils/feature-requests"
import { cn } from "@/lib/utils"

interface FeatureRequestToolbarProps {
  query: FeatureRequestBoardQuery
  total: number
}

function chipClass(active: boolean): string {
  return cn(
    "rounded-full px-3 py-1 text-sm transition-colors",
    active ? "bg-[#E8F0FE] font-medium text-[#2F5FE0]" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200",
  )
}

export function FeatureRequestToolbar({ query, total }: FeatureRequestToolbarProps) {
  const statusLabel = FEATURE_REQUEST_STATUS_FILTER_LABEL[query.status]

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <details className="group relative w-full sm:w-44">
          <summary className="flex h-10 cursor-pointer list-none items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900">
            {statusLabel} ({total})
            <span className="text-neutral-400" aria-hidden>
              ▾
            </span>
          </summary>
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-neutral-200 bg-white p-1 shadow-lg">
            {FEATURE_REQUEST_STATUS_FILTERS.map((status) => (
              <Link
                key={status}
                href={featureRequestBoardHref({ ...query, status, page: 1 })}
                className={cn(
                  "block rounded-md px-2 py-1.5 text-sm hover:bg-neutral-50",
                  status === query.status ? "font-medium text-[#2F5FE0]" : "text-neutral-800",
                )}
              >
                {FEATURE_REQUEST_STATUS_FILTER_LABEL[status]}
              </Link>
            ))}
          </div>
        </details>
        <form action={FEATURE_REQUESTS_PATH} method="get" className="min-w-0 flex-1">
          {query.status !== "open" ? <input type="hidden" name="status" value={query.status} /> : null}
          {query.sort !== "top" ? <input type="hidden" name="sort" value={query.sort} /> : null}
          {query.kind !== "all" ? <input type="hidden" name="kind" value={query.kind} /> : null}
          <input
            name="q"
            defaultValue={query.q}
            placeholder="Search ideas"
            aria-label="Search ideas"
            className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400"
          />
        </form>
        <Link
          href="/feature-requests/new"
          className="inline-flex h-10 w-full shrink-0 items-center justify-center rounded-full bg-[#3B6CF6] px-4 text-sm font-medium text-white shadow-sm hover:bg-[#2F5FE0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B6CF6] focus-visible:ring-offset-2 sm:w-auto"
        >
          Post an idea
        </Link>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {FEATURE_REQUEST_SORTS.map((sort) => (
          <Link
            key={sort}
            href={featureRequestBoardHref({ ...query, sort, page: 1 })}
            aria-current={query.sort === sort ? "page" : undefined}
            className={chipClass(query.sort === sort)}
          >
            {FEATURE_REQUEST_SORT_LABEL[sort]}
          </Link>
        ))}
        <span className="mx-1 hidden h-4 w-px bg-neutral-200 sm:inline-block" aria-hidden />
        {FEATURE_REQUEST_KIND_FILTERS.map((kind) => (
          <Link
            key={kind}
            href={featureRequestBoardHref({ ...query, kind, page: 1 })}
            aria-current={query.kind === kind ? "page" : undefined}
            className={chipClass(query.kind === kind)}
          >
            {FEATURE_REQUEST_KIND_FILTER_LABEL[kind]}
          </Link>
        ))}
      </div>
    </div>
  )
}
