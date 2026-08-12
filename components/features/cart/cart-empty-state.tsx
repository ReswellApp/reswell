import Link from "next/link"
import { ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { marketplaceFeedHref } from "@/lib/marketplace-feed-tab"

export function CartEmptyState() {
  return (
    <main className="flex-1 bg-white antialiased dark:bg-background">
      <div className="mx-auto flex min-h-[55vh] max-w-lg flex-col justify-center px-6 py-24 text-center sm:px-8">
        <div className="mx-auto mb-10 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100/90 ring-1 ring-black/[0.04] dark:bg-muted dark:ring-white/10">
          <ShoppingCart className="h-6 w-6 text-neutral-400" strokeWidth={1} />
        </div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-foreground md:text-[32px]">
          Your cart is empty
        </h1>
        <Button
          asChild
          className="mx-auto mt-10 h-11 min-w-[11rem] rounded-lg bg-[#5574AD] px-7 text-[15px] font-medium text-white shadow-sm hover:bg-[#466091]"
          size="lg"
        >
          <Link href={marketplaceFeedHref("new")}>Browse boards</Link>
        </Button>
      </div>
    </main>
  )
}
