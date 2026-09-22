import Link from "next/link"
import { FeatureRequestAvatar } from "@/components/features/feature-requests/feature-request-avatar"
import { FeatureRequestMeta } from "@/components/features/feature-requests/feature-request-meta"
import { FeatureRequestVoteButton } from "@/components/features/feature-requests/feature-request-vote-button"
import { formatDistanceToNowLabel, RelativeTime } from "@/components/ui/relative-time"
import type { FeatureRequestListItem } from "@/lib/types/feature-requests"
import {
  featureRequestAuthorLabel,
  featureRequestCommentLabel,
  featureRequestExcerpt,
  featureRequestPath,
} from "@/lib/utils/feature-requests"

interface FeatureRequestRowProps {
  request: FeatureRequestListItem
}

export function FeatureRequestRow({ request }: FeatureRequestRowProps) {
  const href = featureRequestPath(request.number)

  return (
    <li className="flex gap-3 py-5 sm:gap-4">
      <FeatureRequestVoteButton
        requestId={request.id}
        voteCount={request.voteCount}
        voted={request.votedByViewer}
        returnPath={href}
      />
      <Link href={href} className="min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B6CF6]">
        <FeatureRequestMeta
          kind={request.kind}
          status={request.status}
          tags={request.tags}
          number={request.number}
          estimatedLabel={request.estimatedLabel}
        />
        <h2 className="mt-1.5 text-[15px] font-semibold leading-snug text-neutral-950">{request.title}</h2>
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-neutral-600">
          {featureRequestExcerpt(request.body)}
        </p>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-neutral-500">
          <span className="inline-flex min-w-0 items-center gap-2">
            <FeatureRequestAvatar displayName={request.author.displayName} avatarUrl={request.author.avatarUrl} />
            <span className="truncate">{featureRequestAuthorLabel(request.author.displayName)}</span>
          </span>
          <span className="shrink-0">
            {featureRequestCommentLabel(request.commentCount)}
            <span aria-hidden> · </span>
            <RelativeTime iso={request.createdAt} formatLabel={formatDistanceToNowLabel} />
          </span>
        </div>
      </Link>
    </li>
  )
}
