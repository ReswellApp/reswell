import { cn } from "@/lib/utils"
import { blogTagAccents } from "@/lib/utils/blog-tag-accents"

type Size = "card" | "hero"

type Props = {
  title: string
  tag: string
  size?: Size
  className?: string
}

/**
 * Typographic stand-in when a post has no copyright-free cover photo.
 * Decorative: listing and article pages already expose the title in text.
 */
export function BlogTitleCover({ title, tag, size = "card", className }: Props) {
  const accent = blogTagAccents(tag)
  const tagLabel = tag.trim() || "Blog"
  const isHero = size === "hero"

  return (
    <div
      aria-hidden
      className={cn(
        "relative flex h-full min-h-0 w-full flex-col justify-between overflow-hidden bg-[#04070E] text-left",
        isHero ? "px-6 py-7 sm:px-10 sm:py-10 lg:px-14 lg:py-12" : "px-5 py-5 sm:px-6 sm:py-6",
        className,
      )}
    >
      <div className={cn("absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b sm:w-2", accent.stripe)} />
      <p
        className={cn(
          "font-semibold uppercase tracking-[0.18em] text-sky-200/85",
          isHero ? "text-[11px] sm:text-xs" : "text-[10px] sm:text-[11px]",
        )}
      >
        Reswell · {tagLabel}
      </p>
      <p
        className={cn(
          "max-w-3xl text-balance font-bold leading-[1.08] tracking-tight text-white",
          isHero
            ? "mt-8 line-clamp-5 text-3xl sm:mt-10 sm:text-5xl lg:text-6xl"
            : "mt-4 line-clamp-4 text-xl sm:text-2xl",
        )}
      >
        {title}
      </p>
      <p
        className={cn(
          "font-medium uppercase tracking-[0.16em] text-slate-400",
          isHero ? "mt-8 text-xs sm:text-sm" : "mt-4 text-[10px] sm:text-[11px]",
        )}
      >
        reswell.app
      </p>
    </div>
  )
}
