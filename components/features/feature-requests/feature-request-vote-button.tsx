import { ChevronUp } from "lucide-react"
import { toggleFeatureRequestVoteAction } from "@/lib/actions/featureRequests"
import { cn } from "@/lib/utils"

interface FeatureRequestVoteButtonProps {
  requestId: string
  voteCount: number
  voted: boolean
  returnPath: string
}

export function FeatureRequestVoteButton({
  requestId,
  voteCount,
  voted,
  returnPath,
}: FeatureRequestVoteButtonProps) {
  return (
    <form action={toggleFeatureRequestVoteAction}>
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="returnTo" value={returnPath} />
      <button
        type="submit"
        aria-pressed={voted}
        aria-label={voted ? "Remove vote" : "Vote for this idea"}
        className={cn(
          "flex w-12 shrink-0 flex-col items-center rounded-lg px-1 py-1.5 transition-colors hover:bg-neutral-100",
          voted ? "text-[#3B6CF6]" : "text-neutral-400",
        )}
      >
        <ChevronUp className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        <span className={cn("text-sm font-semibold tabular-nums", voted ? "text-[#3B6CF6]" : "text-neutral-900")}>
          {voteCount}
        </span>
      </button>
    </form>
  )
}
