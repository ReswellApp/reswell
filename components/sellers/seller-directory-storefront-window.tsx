import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SellerDirectoryMosaicImage } from "@/components/sellers/seller-directory-mosaic-image"
import { VerifiedBadge } from "@/components/verified-badge"
import {
  sellerDirectoryMosaicHasRenderableImage,
  type SellerDirectoryMosaicSlot,
} from "@/lib/sellers/directory-mosaic-images"
import type { SellerDirectorySignature } from "@/lib/sellers/directory-signature"
import { cn } from "@/lib/utils"

const STOREFRONT_SIZES = {
  full: "(max-width: 639px) 50vw, (max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 25vw",
  hero: "(max-width: 639px) 32vw, (max-width: 1023px) 32vw, (max-width: 1279px) 22vw, 16vw",
  stack: "(max-width: 639px) 20vw, (max-width: 1023px) 20vw, (max-width: 1279px) 14vw, 10vw",
} as const

type SellerDirectoryStorefrontWindowProps = {
  href: string
  slots: SellerDirectoryMosaicSlot[]
  label: string
  avatarSrc?: string
  isShop: boolean
  shopVerified: boolean
  locationShort: string | null
  monogram: string
  signature: SellerDirectorySignature
  imagePriority?: boolean
}

function MosaicCell({
  slot,
  sizes,
  imagePriority,
  className,
}: {
  slot: SellerDirectoryMosaicSlot
  sizes: string
  imagePriority?: boolean
  className?: string
}) {
  return (
    <div className={cn("relative min-h-0 min-w-0", className)}>
      <SellerDirectoryMosaicImage
        slot={slot}
        className="h-full w-full"
        sizes={sizes}
        priority={imagePriority}
      />
    </div>
  )
}

function StorefrontMosaic({
  slots,
  imagePriority,
}: {
  slots: SellerDirectoryMosaicSlot[]
  imagePriority?: boolean
}) {
  if (slots.length === 1) {
    return (
      <MosaicCell slot={slots[0]!} sizes={STOREFRONT_SIZES.full} imagePriority={imagePriority} />
    )
  }

  if (slots.length === 2) {
    return (
      <div className="grid h-full grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-[3px]">
        <MosaicCell slot={slots[0]!} sizes={STOREFRONT_SIZES.hero} imagePriority={imagePriority} />
        <MosaicCell slot={slots[1]!} sizes={STOREFRONT_SIZES.stack} />
      </div>
    )
  }

  return (
    <div className="grid h-full grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] grid-rows-2 gap-[3px]">
      <MosaicCell
        slot={slots[0]!}
        sizes={STOREFRONT_SIZES.hero}
        imagePriority={imagePriority}
        className="row-span-2"
      />
      <MosaicCell slot={slots[1]!} sizes={STOREFRONT_SIZES.stack} />
      <MosaicCell slot={slots[2]!} sizes={STOREFRONT_SIZES.stack} />
    </div>
  )
}

export function SellerDirectoryStorefrontWindow({
  href,
  slots,
  label,
  avatarSrc,
  isShop,
  shopVerified,
  locationShort,
  monogram,
  signature,
  imagePriority = false,
}: SellerDirectoryStorefrontWindowProps) {
  const hasImages = sellerDirectoryMosaicHasRenderableImage(slots)

  return (
    <Link
      href={href}
      className="relative block aspect-[4/3] w-full overflow-hidden rounded-t-xl outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
    >
      {hasImages ? (
        <StorefrontMosaic slots={slots} imagePriority={imagePriority} />
      ) : (
        <div
          className={cn("flex h-full w-full items-center justify-center", signature.panelClass)}
          aria-hidden
        >
          <span
            className={cn(
              "font-headline text-5xl font-bold tracking-tight sm:text-6xl",
              signature.monogramClass,
            )}
          >
            {monogram}
          </span>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-2.5 pb-2 pt-10">
        <div className="flex items-end gap-2">
          <Avatar className="h-8 w-8 shrink-0 border-2 border-white/90 shadow-sm sm:h-9 sm:w-9">
            {avatarSrc ? <AvatarImage src={avatarSrc} alt="" /> : null}
            <AvatarFallback className="bg-white/15 text-xs font-semibold text-white">
              {label.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 pb-0.5">
            <div className="flex min-w-0 items-center gap-1">
              <h2 className="truncate font-headline text-[15px] font-semibold leading-tight text-white">
                {label}
              </h2>
              {shopVerified ? <VerifiedBadge size="sm" className="shrink-0" /> : null}
            </div>
            <p className="mt-0.5 truncate text-[11px] font-medium text-white/80">
              {locationShort ?? (isShop ? "Shop" : "Seller")}
              {locationShort && isShop ? " · Shop" : null}
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}
