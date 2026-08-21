"use client"

import type { ReactNode } from "react"
import Image from "next/image"
import { SiteWordmarkLink } from "@/components/site-wordmark-link"
import { wideShimmer } from "@/lib/image-shimmer"
import { cn } from "@/lib/utils"
import authBackdrop from "@/public/images/brand/auth-backdrop.jpg"

type AuthLandingShellProps = {
  children: ReactNode
  contentClassName?: string
  /** Wider, shorter panel so dense forms (sign-up) fit one viewport. */
  size?: "default" | "wide"
}

export function AuthLandingShell({
  children,
  contentClassName,
  size = "default",
}: AuthLandingShellProps) {
  const isWide = size === "wide"

  return (
    <div className="relative flex h-svh max-h-svh flex-col overflow-hidden">
      <header className="relative z-20 w-full shrink-0 border-b border-border bg-background pt-[env(safe-area-inset-top)] shadow-sm">
        <div className="container mx-auto flex min-h-[56px] min-w-0 items-center px-4 py-2 sm:min-h-[64px] sm:px-6 md:min-h-[80px]">
          <SiteWordmarkLink />
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0" aria-hidden>
          <Image
            src={authBackdrop}
            alt=""
            fill
            priority
            quality={90}
            sizes="100vw"
            className="object-cover object-[center_40%]"
            placeholder="blur"
            blurDataURL={wideShimmer}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/35 to-black/55" />
        </div>

        <main
          className={cn(
            "relative z-10 flex h-full min-h-0 justify-center overflow-y-auto",
            isWide
              ? "items-end px-0 pb-0 pt-2 sm:items-center sm:px-6 sm:py-4"
              : "items-center px-4 py-8 sm:px-6",
          )}
        >
          <div
            className={cn(
              "w-full border border-white/20 bg-background/95 shadow-xl shadow-black/20 backdrop-blur-md",
              isWide
                ? "rounded-t-2xl border-x-0 border-b-0 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:rounded-xl sm:border sm:px-6 sm:py-5 sm:max-w-2xl"
                : "max-w-[22rem] rounded-xl px-5 py-5 sm:px-6 sm:py-6",
              contentClassName,
            )}
          >
            <SiteWordmarkLink
              compact={isWide}
              className={cn("px-0 py-0", isWide ? "mb-2.5" : "mb-4")}
            />
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
