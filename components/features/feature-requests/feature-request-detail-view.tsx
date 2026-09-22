import Link from "next/link"
import { FeatureRequestComments } from "@/components/features/feature-requests/feature-request-comments"
import { FeatureRequestAvatar } from "@/components/features/feature-requests/feature-request-avatar"
import { FeatureRequestMeta } from "@/components/features/feature-requests/feature-request-meta"
import { FeatureRequestShell } from "@/components/features/feature-requests/feature-request-shell"
import { FeatureRequestStaffPanel } from "@/components/features/feature-requests/feature-request-staff-panel"
import { FeatureRequestVoteButton } from "@/components/features/feature-requests/feature-request-vote-button"
import { formatDistanceToNowLabel, RelativeTime } from "@/components/ui/relative-time"
import type { FeatureRequestDetail, FeatureRequestViewer } from "@/lib/types/feature-requests"
import {
  FEATURE_REQUEST_CHANGELOG_PATH,
  featureRequestAuthorLabel,
  featureRequestCode,
  featureRequestPath,
} from "@/lib/utils/feature-requests"

interface FeatureRequestDetailViewProps {
  detail: FeatureRequestDetail
  viewer: FeatureRequestViewer
}

export function FeatureRequestDetailView({ detail, viewer }: FeatureRequestDetailViewProps) {
  const href = featureRequestPath(detail.number)
  const signedIn = viewer != null

  return (
    <main className="flex-1 bg-white">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <FeatureRequestShell active="detail" code={featureRequestCode(detail.number)} />
        <article className="mt-8 flex gap-3 sm:gap-4">
          <FeatureRequestVoteButton
            requestId={detail.id}
            voteCount={detail.voteCount}
            voted={detail.votedByViewer}
            returnPath={href}
          />
          <div className="min-w-0 flex-1">
            <FeatureRequestMeta
              kind={detail.kind}
              status={detail.status}
              tags={detail.tags}
              number={detail.number}
              estimatedLabel={detail.estimatedLabel}
            />
            <h1 className="mt-2 font-headline text-2xl font-bold leading-tight text-neutral-950 sm:text-3xl">
              {detail.title}
            </h1>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{detail.body}</p>
            <div className="mt-4 flex items-center gap-2 text-xs text-neutral-500">
              <FeatureRequestAvatar displayName={detail.author.displayName} avatarUrl={detail.author.avatarUrl} />
              <span>{featureRequestAuthorLabel(detail.author.displayName)}</span>
              <span aria-hidden>·</span>
              <RelativeTime iso={detail.createdAt} formatLabel={formatDistanceToNowLabel} />
            </div>
            {detail.changelog ? (
              <p className="mt-4 text-sm text-neutral-600">
                Shipped in the{" "}
                <Link href={FEATURE_REQUEST_CHANGELOG_PATH} className="font-medium text-[#2F5FE0] hover:underline">
                  changelog
                </Link>
                .
              </p>
            ) : null}
          </div>
        </article>
        <FeatureRequestComments
          requestId={detail.id}
          comments={detail.comments}
          truncated={detail.commentsTruncated}
          signedIn={signedIn}
          returnPath={href}
        />
        {viewer?.isStaff ? <FeatureRequestStaffPanel request={detail} /> : null}
      </div>
    </main>
  )
}
