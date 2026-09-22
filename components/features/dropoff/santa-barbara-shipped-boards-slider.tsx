"use client"

import { Truck } from "lucide-react"
import { formatDistanceToNowStrict } from "date-fns"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { ListingTile, ListingTileSoldStamp } from "@/components/listing-tile"
import { RelativeTime } from "@/components/ui/relative-time"
import { capitalizeWords, formatHomePeerListingConditionLine } from "@/lib/listing-labels"
import { listingDetailHref } from "@/lib/listing-href"
import { listingCardImageSrc, type ListingImageForCard } from "@/lib/listing-image-display"
import {
  homePeerListingTileTitleClass,
  homePeerTilePriceClass,
  homePeerTileSubtitleClass,
  homeUniformScrollBodyClass,
  homeUniformScrollCardClass,
  homeUniformScrollLinkClass,
  homeUniformScrollMetaFooterClass,
  homeUniformScrollTitleSlotClass,
} from "@/lib/home-listing-scroll-styles"
import { cn } from "@/lib/utils"

export type SantaBarbaraShippedBoard = {
  id: string
  slug: string | null
  title: string
  soldPrice: number
  condition: string
  section: string
  soldAt: string
  listingImages: ListingImageForCard[] | null
}

function soldRelativeLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const soldDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dayDiff = Math.round((sod.getTime() - soldDay.getTime()) / 86400000)
  if (dayDiff === 0) return "Sold today"
  if (dayDiff === 1) return "Sold yesterday"
  return `Sold ${formatDistanceToNowStrict(d, { addSuffix: true })}`
}

function ShippedBoardCard({ board }: { board: SantaBarbaraShippedBoard }) {
  const conditionLine = formatHomePeerListingConditionLine(board.condition)

  return (
    <ListingTile
      href={listingDetailHref({ id: board.id, slug: board.slug, section: board.section })}
      listingId={board.id}
      title={board.title}
      imageAlt={capitalizeWords(board.title)}
      imageUrl={listingCardImageSrc(board.listingImages)}
      price={board.soldPrice}
      imageTopLeftOverlay={<ListingTileSoldStamp />}
      linkLayout="unified"
      linkClassName={homeUniformScrollLinkClass}
      cardClassName={homeUniformScrollCardClass}
      cardContentClassName={homeUniformScrollBodyClass}
      showFavorites={false}
      favorites={null}
      titleSlot={
        <div className={homeUniformScrollTitleSlotClass}>
          <h3 className={homePeerListingTileTitleClass}>{capitalizeWords(board.title)}</h3>
        </div>
      }
      subtitle={
        conditionLine ? <p className={homePeerTileSubtitleClass}>{conditionLine}</p> : null
      }
      footerSlot={
        <div className={homeUniformScrollMetaFooterClass}>
          <p className={cn(homePeerTilePriceClass, "text-[#163060]")}>
            Sold for ${board.soldPrice.toFixed(2)}
          </p>
          <div className="mt-1.5 space-y-0.5 text-xs font-normal leading-snug text-muted-foreground">
            <p>
              <RelativeTime
                iso={board.soldAt}
                formatLabel={soldRelativeLabel}
                placeholder="Sold"
              />
            </p>
            <p className="inline-flex items-center gap-1 text-foreground/80">
              <Truck className="h-3 w-3 shrink-0" aria-hidden />
              <span>This board was shipped</span>
            </p>
          </div>
        </div>
      }
    />
  )
}

export function SantaBarbaraShippedBoardsSlider({
  boards,
}: {
  boards: SantaBarbaraShippedBoard[]
}) {
  if (boards.length === 0) return null

  return (
    <Carousel
      opts={{ align: "start", containScroll: "trimSnaps" }}
      className="relative"
    >
      <CarouselContent className="-ml-4">
        {boards.map((board) => (
          <CarouselItem
            key={board.id}
            className="pl-4 basis-[68%] sm:basis-[44%] md:basis-[32%] lg:basis-[24%]"
          >
            <div className="h-full">
              <ShippedBoardCard board={board} />
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="left-0 top-[38%] h-10 w-10 border-border/80 bg-white/95 text-[#001A4A] shadow-sm disabled:hidden sm:-left-4" />
      <CarouselNext className="right-0 top-[38%] h-10 w-10 border-border/80 bg-white/95 text-[#001A4A] shadow-sm disabled:hidden sm:-right-4" />
    </Carousel>
  )
}
