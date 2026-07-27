import { CheckCircle2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import {
  SELL_COMPLETE_BADGE_CLASS,
  SELL_SECTION_CARD_CLASS,
  SELL_SECTION_DESCRIPTION_CLASS,
} from "@/components/features/sell/sell-form-surface"
import { cn } from "@/lib/utils"

/** Section shell shared by surfboard and fins sell flows. */
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
      className={cn("space-y-3 lg:space-y-4", sectionId && "scroll-mt-24")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-foreground lg:text-lg">
            {title}
          </h2>
          {description ? (
            <p className={SELL_SECTION_DESCRIPTION_CLASS}>{description}</p>
          ) : null}
        </div>
        {complete ? (
          <span className={cn("mt-0.5 shrink-0", SELL_COMPLETE_BADGE_CLASS)}>
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Done
          </span>
        ) : null}
      </div>
      <Card className={SELL_SECTION_CARD_CLASS}>
        <CardContent className="p-6 lg:p-8 xl:p-10">{children}</CardContent>
      </Card>
    </section>
  )
}
