import { Heart } from "lucide-react"
import type React from "react"
import { cn } from "@/lib/utils"

type MadeWithLoveSantaBarbaraProps = {
  className?: string
  /** Footer bar uses pale heart on dark blue; light surfaces use listingHeart. */
  variant?: "footer" | "light"
} & React.ComponentPropsWithoutRef<"p">

export function MadeWithLoveSantaBarbara({
  className,
  variant = "footer",
  ...props
}: MadeWithLoveSantaBarbaraProps) {
  return (
    <p
      {...props}
      className={cn(
        "inline-flex flex-wrap items-center justify-center gap-1 text-sm",
        variant === "footer" ? "text-white/75" : "text-muted-foreground",
        className,
      )}
    >
      <span>Made with</span>
      <Heart
        className={cn(
          "h-4 w-4 shrink-0",
          variant === "footer"
            ? "fill-footerHeart text-footerHeart"
            : "fill-listingHeart text-listingHeart",
        )}
        aria-hidden
      />
      <span>in Santa Barbara.</span>
    </p>
  )
}
