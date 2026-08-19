import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

const STAR_FILLED = "bg-listingHeart"
const STAR_EMPTY = "bg-[#DCDCE6] dark:bg-neutral-700"

type ReswellPlatformStarBoxProps = {
  fill: number
  size?: "sm" | "md" | "lg"
  className?: string
  starClassName?: string
}

const sizeClasses = {
  sm: "h-[18px] w-[18px] [&_.star-icon]:h-2.5 [&_.star-icon]:w-2.5",
  md: "h-[26px] w-[26px] [&_.star-icon]:h-3.5 [&_.star-icon]:w-3.5",
  lg: "h-12 w-12 [&_.star-icon]:h-6 [&_.star-icon]:w-6",
} as const

export function ReswellPlatformStarBox({
  fill,
  size = "md",
  className,
  starClassName,
}: ReswellPlatformStarBoxProps) {
  const clamped = Math.min(1, Math.max(0, fill))

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-[3px]",
        sizeClasses[size],
        className,
      )}
    >
      <span className={cn("absolute inset-0", STAR_EMPTY)} aria-hidden />
      <span
        className={cn("absolute inset-y-0 left-0", STAR_FILLED)}
        style={{ width: `${clamped * 100}%` }}
        aria-hidden
      />
      <Star
        className={cn("star-icon absolute inset-0 m-auto fill-white text-white", starClassName)}
        strokeWidth={0}
      />
    </span>
  )
}

export function ReswellPlatformStarBoxRow({
  value,
  size = "md",
  className,
}: {
  value: number
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const clamped = Math.min(5, Math.max(0, value))

  return (
    <div className={cn("flex items-center gap-[3px]", className)} aria-hidden>
      {[0, 1, 2, 3, 4].map((index) => {
        const fill = Math.min(1, Math.max(0, clamped - index))
        return <ReswellPlatformStarBox key={index} fill={fill} size={size} />
      })}
    </div>
  )
}

export function ReswellPlatformSingleStar({ className }: { className?: string }) {
  return (
    <Star className={cn("h-4 w-4 fill-listingHeart text-listingHeart", className)} strokeWidth={0} />
  )
}
