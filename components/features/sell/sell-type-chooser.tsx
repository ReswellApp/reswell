import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

type SellTypeOption = {
  href: string
  title: string
  description: string
  imageSrc: string | null
  imageAlt: string
}

/** Shown on /sell chooser. Other sell flows stay live at their routes until launch. */
const SELL_TYPE_OPTIONS: readonly SellTypeOption[] = [
  {
    href: "/sell?type=surfboard",
    title: "Surfboard",
    description: "List a board from your quiver.",
    imageSrc: "/images/sell/surfboard.jpg",
    imageAlt: "Surfboard",
  },
  {
    href: "/sell/fins",
    title: "Fins",
    description: "List thrusters, quads, twins, or singles.",
    imageSrc: "/images/sell/fins.jpg",
    imageAlt: "Surfboard fin",
  },
]

/** First step of /sell: pick a product type. */
export function SellTypeChooser() {
  return (
    <main className="flex-1 bg-offwhite">
      <div className="container mx-auto max-w-lg px-4 py-12 sm:py-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">What are you listing?</h1>
          <p className="mx-auto mt-3 max-w-sm text-muted-foreground">
            Choose surfboard or fins to get started.
          </p>
        </div>

        <div className="mt-10 space-y-3">
          {SELL_TYPE_OPTIONS.map((option) => (
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
              ) : null}
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
