import type { FeatureRequestKind, FeatureRequestStatus, FeatureRequestTag } from "@/lib/types/feature-requests"
import {
  FEATURE_REQUEST_STATUS_LABEL,
  FEATURE_REQUEST_TAG_LABEL,
  featureRequestCode,
  formatFeatureRequestEstimate,
} from "@/lib/utils/feature-requests"
import { cn } from "@/lib/utils"

const STATUS_CLASS: Record<FeatureRequestStatus, string> = {
  idea: "bg-[#E7F0FF] text-[#2F5FBF]",
  under_review: "bg-[#F3E8FF] text-[#7C3AED]",
  planned: "bg-[#E7F8EF] text-[#15803D]",
  in_progress: "bg-[#FFF1E4] text-[#C2610C]",
  shipped: "bg-[#E7F8EF] text-[#15803D]",
  closed: "bg-neutral-100 text-neutral-500",
}

interface FeatureRequestMetaProps {
  kind: FeatureRequestKind
  status: FeatureRequestStatus
  tags: FeatureRequestTag[]
  number: number
  estimatedLabel: string | null
  className?: string
}

export function FeatureRequestMeta({
  kind,
  status,
  tags,
  number,
  estimatedLabel,
  className,
}: FeatureRequestMetaProps) {
  const estimate = formatFeatureRequestEstimate(estimatedLabel)

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {kind === "bug" ? (
        <span className="rounded-md bg-[#FDE8E8] px-1.5 py-0.5 text-[11px] font-semibold text-[#C24141]">
          Bug
        </span>
      ) : null}
      <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-semibold", STATUS_CLASS[status])}>
        {FEATURE_REQUEST_STATUS_LABEL[status]}
      </span>
      {tags.map((tag) => (
        <span key={tag} className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-600">
          {FEATURE_REQUEST_TAG_LABEL[tag]}
        </span>
      ))}
      <span className="text-xs text-neutral-500">{featureRequestCode(number)}</span>
      {estimate ? <span className="text-xs text-neutral-500">{estimate}</span> : null}
    </div>
  )
}
