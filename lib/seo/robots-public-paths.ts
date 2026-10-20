/**
 * Public paths AI crawlers and research agents should be allowed to fetch.
 * `/l/` is explicit so listing pages stay crawlable beside the homepage: ChatGPT
 * otherwise cites `/?utm_source=chatgpt.com` when it never fetched the board URL.
 */
export const ROBOTS_PUBLIC_ALLOW_PATHS = [
  "/",
  "/l/",
  "/boards",
  "/search",
  "/brands/",
  "/sellers",
  "/sellers/",
  "/api/public/",
  "/openapi.json",
  "/llms.txt",
] as const
