import { cn } from "@/lib/utils"

type Size = "card" | "hero"

type Props = {
  title: string
  tag: string
  size?: Size
  className?: string
}

/**
 * CMS / OG stand-in when a post has no cover photo.
 * Public article pages do not show this — they lead with type.
 */
export function BlogTitleCover({ title, tag, size = "card", className }: Props) {
  const isHero = size === "hero"
  const tagLabel = tag.trim() || "Blog"

  return (
    <div
      aria-hidden
      className={cn(
        "relative flex h-full min-h-0 w-full flex-col justify-end bg-[#163060] text-left",
        isHero ? "px-6 py-7 sm:px-10 sm:py-10" : "px-5 py-5 sm:px-6 sm:py-6",
        className,
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#7F9DD5] sm:text-[11px]">
        {tagLabel}
      </p>
      <p
        className={cn(
          "mt-3 max-w-3xl text-balance font-headline font-semibold leading-[1.12] tracking-tight text-[#F9F9F2]",
          isHero ? "line-clamp-4 text-3xl sm:text-4xl" : "line-clamp-4 text-xl sm:text-2xl",
        )}
      >
        {title}
      </p>
    </div>
  )
}
