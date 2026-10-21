/** Short markdown body for agent 404s — points crawlers at machine-readable indexes. */
export function buildAgentNotFoundMarkdown(origin: string): string {
  const base = origin.replace(/\/$/, "")
  return [
    "# 404 Not Found",
    "",
    "This path does not exist on Reswell.",
    "",
    "Use one of these indexes instead:",
    "",
    `- [Sitemap](${base}/sitemap.xml)`,
    `- [llms.txt](${base}/llms.txt)`,
    `- [OpenAPI](${base}/openapi.json)`,
    `- [Public API docs](${base}/public-api)`,
    "",
  ].join("\n")
}
