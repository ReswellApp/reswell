/**
 * Known AI / agent crawler User-Agent tokens.
 * Used for robots.txt allow rules and WAF allowlist documentation.
 */
export const AI_CRAWLER_USER_AGENTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "Google-Extended",
  "Google-CloudVertexBot",
  "Applebot-Extended",
  "PerplexityBot",
  "Perplexity-User",
  "DeepSeekBot",
  "Amazonbot",
  "Bytespider",
  "CCBot",
  "cohere-ai",
  "meta-externalagent",
  "YouBot",
] as const

export type AiCrawlerUserAgent = (typeof AI_CRAWLER_USER_AGENTS)[number]

export function isAiCrawlerUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent?.trim()) return false
  const ua = userAgent.toLowerCase()
  return AI_CRAWLER_USER_AGENTS.some((token) => ua.includes(token.toLowerCase()))
}
