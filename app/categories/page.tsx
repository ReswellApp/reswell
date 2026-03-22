import Link from "next/link"
import { advancedCategorySections } from "@/lib/site-category-directory"
import { ArrowRight, ChevronRight } from "lucide-react"

export const metadata = {
  title: "All Categories — Reswell",
  description:
    "Browse surfboards by type and used gear by category on Reswell — your community marketplace for surf equipment.",
}

export default function CategoriesPage() {
  return (
      <main className="flex-1 bg-white pb-24 pt-14 md:pb-32 md:pt-20">
        {/* ─── Hero ─── */}
        <div className="border-b border-lightgray/70">
          <div className="container mx-auto max-w-6xl px-5 pb-12 sm:px-8 md:pb-16">
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
              Category Directory
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground md:mt-5 md:text-[1.0625rem] md:leading-[1.7]">
              Every listing category on Reswell in one place. Jump to surfboards
              by shape, wetsuits by thickness, fins by size, and more — each
              link takes you straight to filtered results.
            </p>

            {/* Quick-jump pills */}
            <nav className="mt-8 flex flex-wrap gap-2 md:mt-10">
              {advancedCategorySections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-lightgray bg-softwhite px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-black/25 hover:bg-black/[0.04] hover:text-black dark:hover:border-white/30 dark:hover:bg-white/[0.06] dark:hover:text-white no-underline"
                >
                  {section.title}
                </a>
              ))}
            </nav>
          </div>
        </div>

        {/* ─── Category sections ─── */}
        <div className="container mx-auto max-w-6xl px-5 sm:px-8">
          {advancedCategorySections.map((section, idx) => (
            <section
              key={section.id}
              id={section.id}
              className={`scroll-mt-24 ${idx === 0 ? "pt-14 md:pt-20" : "pt-16 md:pt-20"} ${idx < advancedCategorySections.length - 1 ? "border-b border-lightgray/60 pb-14 md:pb-20" : "pb-4"}`}
            >
              {/* Section header */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="max-w-xl">
                  <h2 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
                    {section.title}
                  </h2>
                  <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground md:text-base md:leading-[1.7]">
                    {section.description}
                  </p>
                </div>
                <Link
                  href={section.browseAllHref}
                  className="group inline-flex shrink-0 items-center gap-1.5 rounded-md bg-black px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-neutral-800 hover:no-underline dark:bg-white dark:text-black dark:hover:bg-neutral-200 sm:mt-1"
                >
                  {section.browseAllLabel}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>

              {/* Subcategory groups */}
              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 md:mt-10">
                {section.subcategories.map((group) => (
                  <div
                    key={group.heading}
                    className="rounded-xl border border-lightgray/80 bg-softwhite/60 p-5 md:p-6"
                  >
                    <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {group.heading}
                    </h3>
                    <ul className="space-y-1.5">
                      {group.links.map((link) => (
                        <li key={link.href + link.label}>
                          <Link
                            href={link.href}
                            className="group/link flex items-center gap-2 rounded-md px-2 py-1.5 text-[0.9375rem] text-foreground transition-colors hover:bg-black/[0.05] hover:text-black hover:no-underline dark:hover:bg-white/[0.08] dark:hover:text-white"
                          >
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-lightgray transition-colors group-hover/link:text-black/40 dark:group-hover/link:text-white/50" />
                            {link.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
  )
}
