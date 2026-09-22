"use client"

import { FollowButton } from "@/components/follows/follow-button"

export function SaveShopAlertCta({
  shopName,
  sellerId,
  sellerSlug,
  sellerCity,
  isFollowing,
  isLoggedIn,
  isOwnProfile,
  viewerHydrated = false,
}: {
  shopName: string
  sellerId: string
  sellerSlug?: string | null
  sellerCity?: string | null
  isFollowing: boolean
  isLoggedIn: boolean
  isOwnProfile: boolean
  viewerHydrated?: boolean
}) {
  if (isOwnProfile) return null

  return (
    <section
      className="rounded-2xl bg-neutral-100 px-6 py-12 text-center sm:px-10 sm:py-16"
      aria-labelledby="save-shop-alert-heading"
    >
      <h2
        id="save-shop-alert-heading"
        className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
      >
        Let the gear come to you
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-sm text-foreground/80 sm:text-base">
        Save this shop and we&apos;ll email you when {shopName} lists something new on Reswell.
      </p>
      <div className="mt-6 flex justify-center">
        <FollowButton
          key={viewerHydrated ? "live" : "shell"}
          sellerId={sellerId}
          sellerSlug={sellerSlug}
          sellerName={shopName}
          sellerCity={sellerCity ?? undefined}
          initialFollowing={isFollowing}
          isLoggedIn={isLoggedIn}
          size="default"
          appearance="profilePage"
          className="[&_button]:h-10 [&_button]:px-5 [&_button]:text-sm"
        />
      </div>
    </section>
  )
}
