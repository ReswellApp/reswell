/** Text embedded with Gemini Embedding 2 and stored on a sell-catalog document. */
export function sellCatalogEmbeddingText(doc: {
  kind: "brand" | "model"
  title: string
  search_blob: string
  categories: readonly string[]
}): string {
  const category = doc.categories[0] ?? "product"
  const title = doc.title.trim()
  const label =
    doc.kind === "brand" ? `${title} ${category} brand` : `${title} ${category}`
  const blob = doc.search_blob.trim()
  const text = blob && blob !== title ? `${label}. ${blob}` : label
  return text.replace(/\s+/g, " ").trim().slice(0, 2000)
}
