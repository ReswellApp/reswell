import Link from "next/link"
import { Info } from "lucide-react"
import { HelpScreenshot } from "@/lib/help-center/content-helpers"
import { HelpCenterBreadcrumbs } from "@/components/features/help-center/help-center-breadcrumbs"
import { HelpCenterShell } from "@/components/features/help-center/help-center-shell"
import { getArticleBreadcrumbs, getHelpArticle, getHelpArticleHref } from "@/lib/help-center/registry"
import type { HelpArticle } from "@/lib/help-center/types"

export function HelpCenterArticleView({ article }: { article: HelpArticle }) {
  const breadcrumbs = getArticleBreadcrumbs(article)
  const relatedArticles =
    article.relatedSlugs
      ?.map((slug) => getHelpArticle(article.topicId, slug))
      .filter((related): related is HelpArticle => related != null) ?? []

  return (
    <HelpCenterShell showSearch>
      <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <HelpCenterBreadcrumbs items={breadcrumbs} />

        <h1 className="mt-6 font-headline text-3xl font-bold leading-tight text-neutral-900 sm:text-4xl">
          {article.title}
        </h1>

        <p className="mt-4 text-base leading-relaxed text-neutral-600">{article.description}</p>

        {article.quickAnswer ? (
          <div className="mt-8 rounded-md border border-listingHeart/20 bg-listingHeart/5 px-5 py-4">
            <div className="flex gap-3">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-listingHeart" aria-hidden />
              <div>
                <p className="font-bold text-neutral-900">Quick answer</p>
                <div className="mt-2 text-sm leading-relaxed text-neutral-800 [&_a]:font-medium [&_a]:text-listingHeart [&_a]:underline [&_a]:underline-offset-2">
                  {article.quickAnswer}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-8 space-y-10 text-neutral-900">
          {article.sections.map((section, index) => (
            <section key={index}>
              {section.heading ? (
                <h2 className="mb-4 text-xl font-bold text-neutral-900">{section.heading}</h2>
              ) : null}
              <div className="text-base leading-relaxed text-neutral-800 [&_a]:font-medium [&_a]:text-listingHeart [&_a]:underline [&_a]:underline-offset-2 [&_li]:leading-relaxed [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:space-y-4 [&_ol]:pl-5 [&_p+p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
                {section.body}
              </div>
              {section.figure ? <HelpScreenshot {...section.figure} /> : null}
            </section>
          ))}
        </div>

        {relatedArticles.length > 0 ? (
          <section className="mt-12 border-t border-neutral-200 pt-8">
            <h2 className="text-lg font-bold text-neutral-900">Related articles</h2>
            <ul className="mt-4 space-y-2">
              {relatedArticles.map((related) => (
                <li key={related.slug}>
                  <Link
                    href={getHelpArticleHref(related)}
                    className="text-sm font-medium text-listingHeart underline underline-offset-2"
                  >
                    {related.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </HelpCenterShell>
  )
}
