import { MapPin, Package, Printer } from "lucide-react"
import type { LucideIcon } from "lucide-react"

const VALUES: readonly { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Printer,
    title: "A label after checkout",
    body: "Reswell buys the carrier label from the box size on your listing. Print it from Sales.",
  },
  {
    icon: Package,
    title: "Pack it so it arrives",
    body: "Tape the rails, use a snug board box, and fill the gaps so nothing shifts in transit.",
  },
  {
    icon: MapPin,
    title: "Pickup still works",
    body: "Meet locally, or drop a board in Santa Barbara and we pack and ship it for you.",
  },
]

export function HowToShipValueStrip() {
  return (
    <section aria-label="Why shipping on Reswell is simple" className="bg-white">
      <ul className="mx-auto grid max-w-6xl gap-12 px-4 py-14 sm:px-6 sm:py-16 md:grid-cols-3 md:gap-8">
        {VALUES.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex flex-col items-center text-center">
            <span className="flex h-24 w-24 items-center justify-center rounded-full bg-[#d5eef4]">
              <Icon className="h-10 w-10 text-[#355185]" strokeWidth={1.5} aria-hidden />
            </span>
            <h2 className="mt-5 text-xl font-semibold tracking-tight text-[#001A4A]">{title}</h2>
            <p className="mt-2 max-w-xs text-base leading-relaxed text-[#243044]">{body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
