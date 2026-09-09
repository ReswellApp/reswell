import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function SellerResourcesSection({
  id,
  eyebrow,
  title,
  lead,
  children,
  wash = false,
  className,
}: {
  id?: string
  eyebrow?: string
  title: string
  lead?: ReactNode
  children?: ReactNode
  wash?: boolean
  className?: string
}) {
  return (
    <section
      id={id}
      className={cn(wash ? "bg-[#F4F7FB]" : "bg-white", className)}
    >
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <header className="mx-auto max-w-2xl text-center">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5574AD]">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-2 font-headline text-3xl font-bold tracking-tight text-[#001A4A] sm:text-4xl">
            {title}
          </h2>
          {lead ? (
            <p className="mt-3 text-base leading-relaxed text-[#5c6b89]">{lead}</p>
          ) : null}
        </header>
        {children ? <div className="mt-10">{children}</div> : null}
      </div>
    </section>
  )
}

export { SellerResourcesSection as HowToSellSection }
