import Link from "next/link"
import { helpCenterAdditionalResources } from "@/lib/help-center/content"
import { cn } from "@/lib/utils"

export function HelpCenterAdditionalResources() {
  return (
    <section className="bg-white px-4 py-14 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center font-headline text-2xl font-bold text-neutral-900 sm:text-3xl">
          Additional resources
        </h2>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {helpCenterAdditionalResources.map((resource) => (
            <Link
              key={resource.title}
              href={resource.href}
              className={cn(
                "flex min-h-[4.5rem] items-center rounded-md border border-[#d4c4a8] bg-white px-5 py-4 text-left font-bold text-neutral-900 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2",
                resource.highlight && "text-listingHeart underline decoration-listingHeart underline-offset-2",
              )}
            >
              {resource.title}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
