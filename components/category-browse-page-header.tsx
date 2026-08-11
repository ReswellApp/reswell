import type { ReactNode } from "react"
import Image, { type StaticImageData } from "next/image"
import { wideShimmer } from "@/lib/image-shimmer"
import { cn } from "@/lib/utils"

type Props = {
  title?: string
  description?: string
  /** Filter control (and anything else) aligned to the title row. */
  action?: ReactNode
  className?: string
  /** Optional atmosphere photo behind the title (favorites-style). */
  atmosphereImage?: StaticImageData | string
  /** Optional `object-*` classes for atmosphere crop (defaults suit /fins). */
  atmosphereImageClassName?: string
}

/**
 * Shared category browse header: title + description on the left, action (Filter) on the right.
 */
export function CategoryBrowsePageHeader({
  title,
  description,
  action,
  className,
  atmosphereImage,
  atmosphereImageClassName,
}: Props) {
  const hasTitle = Boolean(title?.trim())
  const hasAtmosphere = Boolean(atmosphereImage)

  if (hasAtmosphere && atmosphereImage && hasTitle) {
    return (
      <header className={cn("w-full min-w-0", className)}>
        <div className="relative h-40 w-full overflow-hidden rounded-2xl border border-border/60 sm:h-48">
          <Image
            src={atmosphereImage}
            alt=""
            fill
            priority
            quality={92}
            sizes="(max-width: 1280px) 100vw, 1400px"
            className={cn(
              "object-cover object-[center_26%] md:object-[center_18%]",
              atmosphereImageClassName,
            )}
            placeholder="blur"
            blurDataURL={wideShimmer}
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/20 to-black/5"
            aria-hidden
          />
          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-4 px-5 pb-5 pt-12 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:px-6 sm:pb-6">
            <div className="min-w-0 max-w-2xl">
              <h1 className="font-headline text-3xl font-semibold tracking-tight text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.55)] sm:text-[2.125rem] sm:leading-tight">
                {title!.trim()}
              </h1>
              {description?.trim() ? (
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/95 [text-shadow:0_1px_3px_rgba(0,0,0,0.5)] sm:text-[15px]">
                  {description.trim()}
                </p>
              ) : null}
            </div>
            {action ? <div className="shrink-0 sm:pb-0.5">{action}</div> : null}
          </div>
        </div>
      </header>
    )
  }

  return (
    <header className={cn("w-full min-w-0 border-b border-neutral-200/90 pb-5", className)}>
      {hasTitle ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div className="min-w-0 max-w-2xl">
            <h1 className="font-headline text-3xl font-semibold tracking-tight text-[#001A4A] sm:text-[2.125rem] sm:leading-tight">
              {title!.trim()}
            </h1>
            {description?.trim() ? (
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#5c6b89] sm:text-[15px]">
                {description.trim()}
              </p>
            ) : null}
          </div>
          {action ? <div className="sm:pb-0.5">{action}</div> : null}
        </div>
      ) : (
        (action ?? null)
      )}
    </header>
  )
}
