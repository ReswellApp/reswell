import { Card, CardContent } from "@/components/ui/card"
import {
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
}: {
  title: string
  children: React.ReactNode
  description?: string
  sectionId?: string
}) {
  return (
    <section
      id={sectionId}
      className={cn("space-y-3 lg:space-y-4", sectionId && "scroll-mt-24")}
    >
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground lg:text-lg">
          {title}
        </h2>
        {description ? (
          <p className={SELL_SECTION_DESCRIPTION_CLASS}>{description}</p>
        ) : null}
      </div>
      <Card className={SELL_SECTION_CARD_CLASS}>
        <CardContent className="p-6 lg:p-8 xl:p-10">{children}</CardContent>
      </Card>
    </section>
  )
}
