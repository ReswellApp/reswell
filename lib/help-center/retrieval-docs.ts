import { accountsRetrievalDocs } from "./retrieval-docs/accounts.ts"
import { buyingRetrievalDocs } from "./retrieval-docs/buying.ts"
import { sellingRetrievalDocs } from "./retrieval-docs/selling.ts"
import { helpArticleId } from "./paths.ts"
import type { HelpCenterTabId, HelpRetrievalDocument } from "./types.ts"

/** Ticket-reply systems should read these plain-text docs — not scrape article JSX. */

export const helpRetrievalDocuments: HelpRetrievalDocument[] = [
  ...buyingRetrievalDocs,
  ...sellingRetrievalDocs,
  ...accountsRetrievalDocs,
]

const documentsById = new Map<string, HelpRetrievalDocument>(
  helpRetrievalDocuments.map((doc) => [doc.id, doc]),
)

export function getHelpRetrievalDocument(
  topicId: HelpCenterTabId,
  slug: string,
): HelpRetrievalDocument | undefined {
  return documentsById.get(helpArticleId(topicId, slug))
}

export function getAllHelpRetrievalDocuments(): HelpRetrievalDocument[] {
  return helpRetrievalDocuments
}

export function helpRetrievalHaystack(doc: HelpRetrievalDocument): string {
  return [
    doc.title,
    doc.description,
    doc.quickAnswer,
    doc.audience,
    ...doc.intentTags,
    ...doc.keywords,
    ...doc.sections.map((section) => [section.heading, section.text].filter(Boolean).join(" ")),
  ]
    .join(" ")
    .toLowerCase()
}

/** Keyword search over structured help docs — intended for support retrieval and ticket replies. */
export function searchHelpRetrievalDocuments(
  query: string,
  documents: HelpRetrievalDocument[] = helpRetrievalDocuments,
): HelpRetrievalDocument[] {
  const q = query.trim().toLowerCase()
  if (!q) return documents
  return documents.filter((doc) => helpRetrievalHaystack(doc).includes(q))
}
