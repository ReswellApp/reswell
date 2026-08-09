import { CheckCircle2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import {
  SELL_COMPLETE_BADGE_CLASS,
  SELL_SECTION_CARD_CLASS,
  SELL_SECTION_DESCRIPTION_CLASS,
} from "@/components/features/sell/sell-form-surface"
import { cn } from "@/lib/utils"

/** Section shell shared by surfboard and peer sell flows. */
export function SellFormSection({
  title,
  children,
  description,
  sectionId,
  complete,
}: {
  title: string
  children: React.ReactNode
  description?: string
  sectionId?: string
  /** When true, shows a compact “Done” badge beside the section title. */
  complete?: boolean
}) {
  return (
    <section
      id={sectionId}
      className={cn("space-y-4 sm:space-y-6", sectionId && "scroll-mt-28")}
    >
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          {/* Mobile: Reverb-scale page title. Desktop: still prominent but not oversized. */}
          <h2 className="text-[1.75rem] font-bold leading-tight tracking-tight text-foreground sm:text-[1.85rem] lg:text-3xl">
            {title}
          </h2>
          {description ? (
            <p
              className={cn(
                SELL_SECTION_DESCRIPTION_CLASS,
                /* Keep mobile helper quieter so the title + card dominate */
                "text-[15px] sm:text-base lg:text-[17px]",
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
        {complete ? (
          <span className={cn("mt-1.5 hidden shrink-0 sm:inline-flex", SELL_COMPLETE_BADGE_CLASS)}>
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Done
          </span>
        ) : null}
      </div>
      <Card className={SELL_SECTION_CARD_CLASS}>
        <CardContent className="p-5 sm:p-9 lg:p-11">{children}</CardContent>
      </Card>
    </section>
  )
}
