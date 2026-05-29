import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { boardsBrowseLinkPrefetch } from "@/lib/boards-link-prefetch"
import { advancedCategorySections } from "@/lib/site-category-directory"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export const revalidate = 3600

export async function generateMetadata() {
  return resolvePageMetadata("categories")
}

export default function CategoriesPage() {
  return (
    <main className="flex-1">
      <section className="border-b border-border/80 bg-offwhite">
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
          <div
            className="pointer-events-none absolute -right-24 top-0 h-72 w-72 rounded-full bg-primary/[0.07] blur-3xl"
            aria-hidden
          />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Marketplace</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl text-balance">
              Categories
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Pick a surfboard shape or browse everything on the boards feed — every link opens live listings from the
              community.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-12 sm:space-y-14 sm:px-6 sm:py-16">
        {advancedCategorySections.map((section) => (
          <section key={section.id} aria-labelledby={`category-section-${section.id}`}>
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2
                  id={`category-section-${section.id}`}
                  className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
                >
                  {section.title}
                </h2>
                <p className="mt-2 max-w-2xl text-muted-foreground">{section.description}</p>
              </div>
              <Button asChild variant="outline" className="shrink-0 gap-1 self-start sm:self-auto">
                <Link
                  href={section.browseAllHref}
                  prefetch={boardsBrowseLinkPrefetch(section.browseAllHref)}
                >
                  {section.browseAllLabel}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {section.subcategories.map((group) => (
                <Card key={group.heading} className="border-border/80 shadow-soft">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold">{group.heading}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="flex flex-col gap-2">
                      {group.links.map((link) => (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            prefetch={boardsBrowseLinkPrefetch(link.href)}
                            className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                          >
                            {link.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
