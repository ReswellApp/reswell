import Link from "next/link"
import { FeatureRequestRow } from "@/components/features/feature-requests/feature-request-row"
import { FEATURE_REQUEST_PAGE_SIZE, type FeatureRequestBoard } from "@/lib/types/feature-requests"
import { featureRequestBoardHref } from "@/lib/utils/feature-requests"

interface FeatureRequestListProps {
  board: FeatureRequestBoard
}

export function FeatureRequestList({ board }: FeatureRequestListProps) {
  const hasMore = board.query.page * FEATURE_REQUEST_PAGE_SIZE < board.total

  if (board.degraded) {
    return (
      <p className="border-t border-neutral-200 py-16 text-center text-sm text-neutral-600">
        The board is unavailable right now. Try again in a moment.
      </p>
    )
  }

  if (board.requests.length === 0) {
    return (
      <div className="border-t border-neutral-200 py-16 text-center">
        <p className="text-base font-medium text-neutral-950">
          {board.query.q ? "No ideas match that search" : "No ideas yet"}
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500">
          {board.query.q
            ? "Try a different word, or post the idea yourself."
            : "Be the first to tell us what would make buying and selling on Reswell better."}
        </p>
      </div>
    )
  }

  return (
    <div>
      <ul className="divide-y divide-neutral-200 border-t border-neutral-200">
        {board.requests.map((request) => (
          <FeatureRequestRow key={request.id} request={request} />
        ))}
      </ul>
      {board.query.page > 1 || hasMore ? (
        <nav className="flex items-center justify-between border-t border-neutral-200 pt-4 text-sm" aria-label="Pagination">
          {board.query.page > 1 ? (
            <Link
              href={featureRequestBoardHref({ ...board.query, page: board.query.page - 1 })}
              className="font-medium text-[#2F5FE0] hover:underline"
            >
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-neutral-500">Page {board.query.page}</span>
          {hasMore ? (
            <Link
              href={featureRequestBoardHref({ ...board.query, page: board.query.page + 1 })}
              className="font-medium text-[#2F5FE0] hover:underline"
            >
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  )
}
