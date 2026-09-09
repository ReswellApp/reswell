import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SURFBOARD_SELL_BOARDS_CREATE_HREF } from "@/lib/sell-flow/surfboard-sell-paths"

export function SellerResourcesCta({
  title = "Ready to start selling?",
  description = "It is free to post. Fees apply only when you make a sale.",
  href = SURFBOARD_SELL_BOARDS_CREATE_HREF,
  label = "Start a listing",
}: {
  title?: string
  description?: string
  href?: string
  label?: string
}) {
  return (
    <section className="bg-[#001A4A] px-4 py-14 text-center sm:px-6 sm:py-16">
      <p className="font-headline text-3xl font-bold text-white">{title}</p>
      <p className="mt-2 text-sm text-white/75">{description}</p>
      <Button
        asChild
        size="lg"
        className="mt-6 rounded-full bg-white px-8 font-semibold text-[#001A4A] hover:bg-white/90"
      >
        <Link href={href}>{label}</Link>
      </Button>
    </section>
  )
}
