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

/** First step of /sell: pick a product type. */
export function SellTypeChooser({ isAdmin = false }: { isAdmin?: boolean }) {
  const options = SELL_TYPE_OPTIONS.filter((option) => !option.adminOnly || isAdmin)

  return (
    <main className="flex-1 bg-offwhite">
      <div className="container mx-auto max-w-lg px-4 py-12 sm:py-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">What are you listing?</h1>
          <p className="mx-auto mt-3 max-w-sm text-muted-foreground">
            Choose a product type to get started.
          </p>
        </div>

        <div className="mt-10 space-y-3">
          {options.map((option) => (
            <Link
              key={option.href}
              href={option.href}
              className={cn(
                "group flex items-center gap-4 rounded-xl border border-border bg-background px-4 py-4 text-left shadow-sm transition-colors sm:px-5",
                "hover:border-foreground/20 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              )}
            >
              {option.imageSrc ? (
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                  <Image
                    src={option.imageSrc}
                    alt={option.imageAlt ?? ""}
                    fill
                    sizes="56px"
                    className="object-cover object-center"
                  />
                </div>
              ) : (
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  aria-hidden
                >
                  {option.title.slice(0, 3)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold">{option.title}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{option.description}</p>
              </div>
              <ArrowRight
                className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                aria-hidden
              />
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
