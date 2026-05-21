import Link from "next/link"
import { HelpCenterBreadcrumbs } from "@/components/features/help-center/help-center-breadcrumbs"
import { HelpCenterShell } from "@/components/features/help-center/help-center-shell"
import { getHelpArticleHref } from "@/lib/help-center/registry"
import { getTopicBreadcrumbs } from "@/lib/help-center/registry"
import type { HelpTopicIndex } from "@/lib/help-center/types"

export function HelpCenterTopicView({ topic }: { topic: HelpTopicIndex }) {
  const breadcrumbs = getTopicBreadcrumbs(topic)

  return (
    <HelpCenterShell showSearch>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <HelpCenterBreadcrumbs items={breadcrumbs} />

        <h1 className="mt-4 font-headline text-3xl font-bold text-neutral-900 sm:text-4xl">
          {topic.label}
        </h1>

        <hr className="mt-6 border-neutral-200" />

        <div className="mt-10 space-y-14">
          {topic.sections.map((section) => (
            <section key={section.slug} id={section.slug} className="scroll-mt-24">
              <h2 className="font-headline text-2xl font-bold text-neutral-900">{section.title}</h2>
              <hr className="mt-4 border-neutral-200" />

              <div className="mt-8 grid gap-10 md:grid-cols-2 md:gap-12">
                {section.groups.map((group) => (
                  <div key={group.title}>
                    <h3 className="text-base font-bold text-neutral-900">{group.title}</h3>
                    <ul className="mt-4 space-y-3">
                      {group.articles.map((article) => (
                        <li key={article.slug}>
                          <Link
                            href={getHelpArticleHref({ topicId: topic.id, slug: article.slug })}
                            className="text-sm text-neutral-900 transition-colors hover:text-listingHeart focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 rounded-sm"
                          >
                            {article.title}
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
      </div>
    </HelpCenterShell>
  )
}
