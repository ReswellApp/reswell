"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, SlidersHorizontal, Zap } from "lucide-react"
import { APPAREL_SELL_ADMIN_ONLY } from "@/lib/apparel-listing-config"
import { cn } from "@/lib/utils"

/** Hub URL that opens the Quick vs Full surfboard path picker (entry only — never a Back target). */
export const SELL_SURFBOARD_PATH_HREF = "/sell?new=1&choose=surfboard"

type SellTypeOption = {
  href: string
  title: string
  description: string
  imageSrc: string | null
  imageAlt: string
  /** When true, only shown to marketplace admins. */
  adminOnly?: boolean
  /** Surfboard opens a Quick vs Full sub-chooser instead of navigating. */
  surfboardFork?: boolean
}

/** Shown on /sell chooser. Other sell flows stay live at their routes until launch. */
const SELL_TYPE_OPTIONS: readonly SellTypeOption[] = [
  {
    href: "/sell/quick",
    title: "Surfboard",
    description: "Quick list or full listing — you choose.",
    imageSrc: "/images/sell/surfboard.jpg",
    imageAlt: "Surfboard",
    surfboardFork: true,
  },
  {
    href: "/sell/fins?step=search&new=1",
    title: "Fins",
    description: "List thrusters, quads, twins, or singles.",
    imageSrc: "/images/sell/fins.jpg",
    imageAlt: "Surfboard fin",
  },
  {
    href: "/sell/wetsuits?new=1",
    title: "Wetsuits",
    description: "List wetsuits for the marketplace.",
    imageSrc: "/images/sell/wetsuits.jpg",
    imageAlt: "Wetsuit",
  },
  {
    href: "/sell/magazines?new=1",
    title: "Magazines",
    description: "List vintage and collectible surf magazines.",
    imageSrc: "/images/sell/magazines.jpg",
    imageAlt: "Surf magazine",
  },
  {
    href: "/sell/apparel?new=1",
    title: "Apparel",
    description: "List boardshorts, hats, t-shirts, and more.",
    imageSrc: null,
    imageAlt: "Apparel",
    adminOnly: APPAREL_SELL_ADMIN_ONLY,
  },
]

function SurfboardPathChooser({ onBack }: { onBack: () => void }) {
  const router = useRouter()

  /** Replace the picker history entry so Back from Quick/Full skips this screen. */
  const enterPath = (href: string) => {
    router.replace(href, { scroll: false })
  }

  return (
    <main className="flex-1 bg-offwhite">
      <div className="container mx-auto max-w-2xl px-4 py-12 sm:py-16">
        <div className="text-center">
          <button
            type="button"
            onClick={onBack}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            All product types
          </button>
          <h1 className="text-3xl font-bold sm:text-4xl">List a surfboard</h1>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Pick the path that fits — you can switch anytime.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-xl gap-3 sm:grid-cols-2 sm:gap-4">
          <button
            type="button"
            onClick={() => enterPath("/sell/quick?new=1")}
            className={cn(
              "group flex flex-col gap-3 rounded-2xl border border-border bg-background p-5 text-left shadow-sm transition-colors",
              "hover:border-foreground/20 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            )}
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground">
              <Zap className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="flex items-center gap-1.5 text-lg font-semibold">
                Quick list
                <ArrowRight
                  className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                  aria-hidden
                />
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Photos, price, and pickup — live in under a minute.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => enterPath("/sell/boards?new=1")}
            className={cn(
              "group flex flex-col gap-3 rounded-2xl border border-border bg-background p-5 text-left shadow-sm transition-colors",
              "hover:border-foreground/20 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            )}
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground">
              <SlidersHorizontal className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="flex items-center gap-1.5 text-lg font-semibold">
                Full listing
                <ArrowRight
                  className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                  aria-hidden
                />
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Shipping, drafts, and every detail — for a polished listing.
              </p>
            </div>
          </button>
        </div>
      </div>
    </main>
  )
}

/** Product-type chooser on /sell (shown after skipping the catalog search wall). */
export function SellTypeChooser({
  isAdmin = false,
  onBackToSearch,
  initialSurfboardPath = false,
}: {
  isAdmin?: boolean
  onBackToSearch?: () => void
  /** Open Quick vs Full immediately (e.g. Back from /sell/quick). */
  initialSurfboardPath?: boolean
}) {
  const router = useRouter()
  const [surfboardPath, setSurfboardPath] = useState(initialSurfboardPath)
  const options = SELL_TYPE_OPTIONS.filter((option) => !option.adminOnly || isAdmin)

  if (surfboardPath) {
    return (
      <SurfboardPathChooser
        onBack={() => {
          setSurfboardPath(false)
          // Drop `choose=surfboard` so refresh shows the type grid.
          router.replace("/sell?new=1", { scroll: false })
        }}
      />
    )
  }

  return (
    <main className="flex-1 bg-offwhite">
      <div className="container mx-auto max-w-2xl px-4 py-12 sm:py-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">What are you listing?</h1>
          <p className="mx-auto mt-3 max-w-sm text-muted-foreground">
            Choose a product type to get started.
          </p>
          {onBackToSearch ? (
            <button
              type="button"
              className="mt-3 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              onClick={onBackToSearch}
            >
              Search the catalog instead
            </button>
          ) : null}
        </div>

        <div className="mx-auto mt-10 grid max-w-xl grid-cols-2 gap-3 sm:gap-4">
          {options.map((option) => {
            const cardClass = cn(
              "group flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-border bg-background p-4 text-center shadow-sm transition-colors",
              "hover:border-foreground/20 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            )
            const body = (
              <>
                {option.imageSrc ? (
                  <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
                    <Image
                      src={option.imageSrc}
                      alt={option.imageAlt ?? ""}
                      fill
                      sizes="(min-width: 640px) 288px, 45vw"
                      className="object-cover object-center"
                    />
                  </div>
                ) : (
                  <div
                    className="flex aspect-square w-full items-center justify-center rounded-xl bg-muted text-sm font-semibold uppercase tracking-wide text-muted-foreground"
                    aria-hidden
                  >
                    {option.title.slice(0, 3)}
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="flex items-center justify-center gap-1.5 text-xl font-semibold">
                    {option.title}
                    <ArrowRight
                      className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                      aria-hidden
                    />
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">{option.description}</p>
                </div>
              </>
            )

            if (option.surfboardFork) {
              return (
                <button
                  key={option.title}
                  type="button"
                  className={cardClass}
                  onClick={() => {
                    setSurfboardPath(true)
                    router.replace(SELL_SURFBOARD_PATH_HREF, { scroll: false })
                  }}
                >
                  {body}
                </button>
              )
            }

            return (
              <Link key={option.href} href={option.href} className={cardClass}>
                {body}
              </Link>
            )
          })}
        </div>
      </div>
    </main>
  )
}
