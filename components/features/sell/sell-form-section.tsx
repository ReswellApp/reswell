import { Card, CardContent } from "@/components/ui/card"
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
          <p className="mt-1 text-sm text-muted-foreground/45 lg:mt-1.5 lg:text-base">
            {description}
          </p>
        ) : null}
      </div>
      <Card className="shadow-sm hover:shadow-sm lg:shadow-md">
        <CardContent className="p-6 lg:p-8 xl:p-10">{children}</CardContent>
      </Card>
    </section>
  )
}
