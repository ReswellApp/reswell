import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { APPAREL_SELL_ADMIN_ONLY } from "@/lib/apparel-listing-config"
import { cn } from "@/lib/utils"

type SellTypeOption = {
  href: string
  title: string
  description: string
  imageSrc: string | null
  imageAlt: string
  /** When true, only shown to marketplace admins. */
  adminOnly?: boolean
}

/** Shown on /sell chooser. Other sell flows stay live at their routes until launch. */
const SELL_TYPE_OPTIONS: readonly SellTypeOption[] = [
  {
    href: "/sell/boards?new=1",
    title: "Surfboard",
    description: "List a board from your quiver.",
    imageSrc: "/images/sell/surfboard.jpg",
    imageAlt: "Surfboard",
  },
  {
    href: "/sell/fins?step=search&new=1",
    title: "Fins",
    description: "List thrusters, quads, twins, or singles.",
    imageSrc: "/images/sell/fins.jpg",
    imageAlt: "Surfboard fin",
  },
  {
    href: "/sell/wetsuits",
    title: "Wetsuits",
    description: "List wetsuits for the marketplace.",
    imageSrc: "/images/sell/wetsuits.jpg",
    imageAlt: "Wetsuit",
  },
  {
    href: "/sell/magazines",
    title: "Magazines",
    description: "List vintage and collectible surf magazines.",
    imageSrc: "/images/sell/magazines.jpg",
    imageAlt: "Surf magazine",
  },
  {
    href: "/sell/apparel",
    title: "Apparel",
    description: "List boardshorts, hats, t-shirts, and more.",
    imageSrc: null,
    imageAlt: "Apparel",
    adminOnly: APPAREL_SELL_ADMIN_ONLY,
  },
]

/** Product-type chooser on /sell (shown after skipping the catalog search wall). */
export function SellTypeChooser({
  isAdmin = false,
  onBackToSearch,
}: {
  isAdmin?: boolean
  onBackToSearch?: () => void
}) {
  const options = SELL_TYPE_OPTIONS.filter((option) => !option.adminOnly || isAdmin)

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
          {options.map((option) => (
            <Link
              key={option.href}
              href={option.href}
              className={cn(
                "group flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-border bg-background p-4 text-center shadow-sm transition-colors",
                "hover:border-foreground/20 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              )}
            >
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
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
