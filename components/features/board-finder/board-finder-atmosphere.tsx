import Image from "next/image"

import { BoardFinderPreviewTicket } from "@/components/features/board-finder/board-finder-preview-ticket"
import shoreline from "@/public/images/board-finder/shoreline.jpg"
import { cn } from "@/lib/utils"

export function BoardFinderAtmosphere({
  title,
  detail,
  hasCriteria,
  emailOptIn,
  className,
}: {
  title: string
  detail: string
  hasCriteria: boolean
  emailOptIn: boolean
  className?: string
}) {
  return (
    <figure className={cn("lg:sticky lg:top-28", className)}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-[#d5e4ea]">
        <Image
          src={shoreline}
          alt="Aerial view of pale sand meeting calm turquoise water"
          fill
          priority
          placeholder="blur"
          sizes="(max-width: 1024px) 100vw, 26rem"
          className="object-cover"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b2430]/45 via-[#0b2430]/5 to-transparent"
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
          <BoardFinderPreviewTicket
            title={title}
            detail={detail}
            hasCriteria={hasCriteria}
            emailOptIn={emailOptIn}
          />
        </div>
      </div>
      <figcaption className="mt-2.5 text-right text-[11px] tracking-wide text-[#7d8c9b]">
        Photograph · Unsplash
      </figcaption>
    </figure>
  )
}
