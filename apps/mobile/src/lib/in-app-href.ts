import { webHrefToNativePath } from "@reswell/api-contract"
import type { Href, Router } from "expo-router"

/** Native Help Center article. */
export function helpArticleHref(topic: string, slug: string): Href {
  return { pathname: "/help/[topic]/[slug]", params: { topic, slug } }
}

/** Native Help Center topic. */
export function helpTopicHref(topic: string): Href {
  return { pathname: "/help/[topic]", params: { topic } }
}

/**
 * Map a website or in-app href onto an Expo Router path.
 * Returns null when the tap should stay put — never open the website.
 */
export function inAppHref(href: string | null | undefined): Href | null {
  const mapped = webHrefToNativePath(href)
  return mapped ? (mapped as Href) : null
}

/** Push a mapped href. Returns false when there is no native screen. */
export function pushInAppHref(router: Router, href: string | null | undefined): boolean {
  const path = inAppHref(href)
  if (!path) return false
  router.push(path)
  return true
}
