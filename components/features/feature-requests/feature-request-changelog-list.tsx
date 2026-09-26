import Link from "next/link"
import type { FeatureRequestChangelogBoard } from "@/lib/types/feature-requests"
import { featureRequestCode, featureRequestPath, formatFeatureRequestDate } from "@/lib/utils/feature-requests"

interface FeatureRequestChangelogListProps {
  board: FeatureRequestChangelogBoard
}

export function FeatureRequestChangelogList({ board }: FeatureRequestChangelogListProps) {
  if (board.degraded) {
    return (
      <p className="mt-10 border-t border-neutral-200 py-16 text-center text-sm text-neutral-600">
        The changelog is unavailable right now. Try again in a moment.
      </p>
    )
  }

  if (board.entries.length === 0) {
    return (
      <div className="mt-10 border-t border-neutral-200 py-16 text-center">
        <p className="text-base font-medium text-neutral-950">Nothing shipped yet</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500">
          When Reswell builds something from this board, it shows up here.
        </p>
      </div>
    )
  }

  return (
    <ul className="mt-8 divide-y divide-neutral-200 border-t border-neutral-200">
      {board.entries.map((entry) => (
        <li key={entry.id} className="py-6">
          <p className="text-xs font-medium text-neutral-500">{formatFeatureRequestDate(entry.publishedAt)}</p>
          <h2 className="mt-1 text-[15px] font-semibold text-neutral-950">{entry.title}</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{entry.body}</p>
          {entry.requestNumber != null ? (
            <Link
              href={featureRequestPath(entry.requestNumber)}
              className="mt-3 inline-block text-sm font-medium text-[#2F5FE0] hover:underline"
            >
              {featureRequestCode(entry.requestNumber)}
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
