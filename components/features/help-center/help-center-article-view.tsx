import { Info } from "lucide-react"
import { HelpCenterBreadcrumbs } from "@/components/features/help-center/help-center-breadcrumbs"
import { HelpCenterShell } from "@/components/features/help-center/help-center-shell"
import { getArticleBreadcrumbs } from "@/lib/help-center/registry"
import type { HelpArticle } from "@/lib/help-center/types"

export function HelpCenterArticleView({ article }: { article: HelpArticle }) {
  const breadcrumbs = getArticleBreadcrumbs(article)

  return (
    <HelpCenterShell showSearch>
      <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <HelpCenterBreadcrumbs items={breadcrumbs} />

        <h1 className="mt-6 font-headline text-3xl font-bold leading-tight text-neutral-900 sm:text-4xl">
          {article.title}
        </h1>

        {article.quickAnswer ? (
          <div className="mt-8 rounded-md border border-[#93c5fd] bg-[#eff6ff] px-5 py-4">
            <div className="flex gap-3">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#2563eb]" aria-hidden />
              <div>
                <p className="font-bold text-neutral-900">Quick answer</p>
                <div className="mt-2 text-sm leading-relaxed text-neutral-800 [&_a]:text-[#2563eb] [&_a]:underline">
                  {article.quickAnswer}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-8 space-y-8 text-neutral-900">
          {article.sections.map((section, index) => (
            <section key={index}>
              {section.heading ? (
                <h2 className="mb-4 text-xl font-bold text-neutral-900">{section.heading}</h2>
              ) : null}
              <div className="text-base leading-relaxed [&_a]:text-[#2563eb] [&_a]:underline [&_p+p]:mt-4">
                {section.body}
              </div>
            </section>
          ))}
        </div>
      </article>
    </HelpCenterShell>
  )
}
