import Image from "next/image"

import { BoardFinderPreviewTicket } from "@/components/features/board-finder/board-finder-preview-ticket"
import authBackdrop from "@/public/images/brand/auth-backdrop.jpg"
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
      <div className="relative aspect-[3/2] overflow-hidden rounded-[1.75rem] bg-[#9ec4d4]">
        <Image
          src={authBackdrop}
          alt="A large turquoise wave under a pale sky"
          fill
          priority
          placeholder="blur"
          sizes="(max-width: 1024px) 100vw, 26rem"
          className="object-cover object-[center_40%]"
        />
      </div>
      <div className="mt-3">
        <BoardFinderPreviewTicket
          title={title}
          detail={detail}
          hasCriteria={hasCriteria}
          emailOptIn={emailOptIn}
        />
      </div>
    </figure>
  )
}
