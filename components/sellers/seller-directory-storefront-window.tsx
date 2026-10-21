import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SellerDirectoryStorefrontMosaic } from "@/components/sellers/seller-directory-storefront-mosaic"
import { VerifiedBadge } from "@/components/verified-badge"
import {
  sellerDirectoryMosaicHasRenderableImage,
  type SellerDirectoryMosaicSlot,
} from "@/lib/sellers/directory-mosaic-images"
import type { SellerDirectorySignature } from "@/lib/sellers/directory-signature"
import { cn } from "@/lib/utils"

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

function MonogramPanel({
  monogram,
  signature,
}: {
  monogram: string
  signature: SellerDirectorySignature
}) {
  return (
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
  const monogramPanel = <MonogramPanel monogram={monogram} signature={signature} />

  return (
    <Link
      href={href}
      className="relative block aspect-[4/3] w-full overflow-hidden rounded-t-xl outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
    >
      {hasImages ? (
        <SellerDirectoryStorefrontMosaic
          slots={slots}
          imagePriority={imagePriority}
          emptyFallback={monogramPanel}
        />
      ) : (
        monogramPanel
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
