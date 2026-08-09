import { MadeWithLoveSantaBarbara } from "@/components/made-with-love-santa-barbara"
import { cn } from "@/lib/utils"

type SellPageFooterProps = {
  className?: string
}

/** Light thank-you strip at the bottom of every `/sell` route (site footer is hidden there). */
export function SellPageFooter({ className }: SellPageFooterProps) {
  return (
    <footer
      className={cn(
        "w-full shrink-0 border-t border-border/70 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-6",
        className,
      )}
    >
      <div className="container mx-auto px-4 sm:px-6">
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>Thank you for listing on Reswell.</p>
          <MadeWithLoveSantaBarbara
            variant="light"
            className="justify-start gap-1.5 text-sm"
          />
        </div>
      </div>
    </footer>
  )
}
