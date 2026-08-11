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
}

export function AuthLandingShell({
  children,
  contentClassName,
}: AuthLandingShellProps) {
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden">
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

      <main className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <div
          className={cn(
            "w-full max-w-[22rem] rounded-xl border border-white/20 bg-background/95 px-5 py-5 shadow-xl shadow-black/20 backdrop-blur-md sm:px-6 sm:py-6",
            contentClassName,
          )}
        >
          <SiteWordmarkLink className="mb-4 px-0 py-0" />
          {children}
        </div>
      </main>
    </div>
  )
}
