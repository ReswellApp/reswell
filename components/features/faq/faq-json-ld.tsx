/**
 * FAQPage structured data — eligible for FAQ rich results when Google selects the page.
 * @see https://developers.google.com/search/docs/appearance/structured-data/faqpage
 */

export type FaqJsonLdItem = {
  question: string
  answerPlain: string
}

export function FaqJsonLd({ items }: { items: FaqJsonLdItem[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answerPlain,
      },
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
