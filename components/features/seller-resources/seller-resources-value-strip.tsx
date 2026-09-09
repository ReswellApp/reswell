import type { LucideIcon } from "lucide-react"

export type SellerResourcesValue = {
  icon: LucideIcon
  title: string
  body: string
}

export function SellerResourcesValueStrip({ items }: { items: readonly SellerResourcesValue[] }) {
  return (
    <section className="border-y border-border bg-white">
      <ul className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 md:grid-cols-3">
        {items.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex flex-col items-center text-center">
            <Icon className="h-11 w-11 text-[#5574AD]" strokeWidth={1.75} aria-hidden />
            <h2 className="mt-4 text-xl font-bold tracking-tight text-[#001A4A]">{title}</h2>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-[#5c6b89]">{body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
