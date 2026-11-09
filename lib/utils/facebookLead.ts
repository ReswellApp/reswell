/**
 * Parse Facebook profile links and Marketplace message threads, and read a
 * public display name when the page HTML includes one. No login, no session.
 */

const FACEBOOK_HOSTS = new Set([
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "mbasic.facebook.com",
  "web.facebook.com",
  "fb.com",
  "www.fb.com",
  "m.fb.com",
])

const MESSENGER_HOSTS = new Set(["messenger.com", "www.messenger.com"])

const RESERVED_PROFILE_SEGMENTS = new Set([
  "marketplace",
  "messages",
  "watch",
  "groups",
  "events",
  "pages",
  "stories",
  "reel",
  "reels",
  "share",
  "photo",
  "photos",
  "login",
  "profile.php",
  "people",
  "gaming",
  "friends",
  "notifications",
  "settings",
  "help",
  "privacy",
  "policies",
  "bookmarks",
  "saved",
  "memories",
  "jobs",
  "fundraisers",
  "home",
  "search",
])

const GENERIC_PAGE_TITLES = new Set([
  "facebook",
  "log in",
  "log into facebook",
  "login",
  "sign up",
  "error",
  "page not found",
  "content not found",
  "facebook – log in or sign up",
  "facebook - log in or sign up",
])

export const CRM_FACEBOOK_FOLLOW_UP_DAYS = 3
export const CRM_FACEBOOK_SNOOZE_DAYS = 7
export const CRM_FACEBOOK_PLACEHOLDER_FIRST_NAME = "Facebook"

export type ParsedFacebookProfile = {
  profileUrl: string
  profileId: string | null
  username: string | null
  displayName: string | null
}

export type ParsedFacebookThread = {
  threadId: string
  threadUrl: string
  /** Set when the paste was a Marketplace listing, not a Messenger thread. */
  listingId: string | null
}

function stripHost(host: string): string {
  return host.toLowerCase().replace(/\.$/, "")
}

function isFacebookHost(host: string): boolean {
  return FACEBOOK_HOSTS.has(stripHost(host))
}

function isMessengerHost(host: string): boolean {
  return MESSENGER_HOSTS.has(stripHost(host))
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => {
      const n = Number(code)
      return Number.isFinite(n) ? String.fromCodePoint(n) : ""
    })
}

export function peopleSlugToName(slug: string): string | null {
  const cleaned = slug.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim()
  if (!cleaned) return null
  if (!/[a-z]/i.test(cleaned)) return null
  if (cleaned.length > 80) return null
  return cleaned
}

function usableDisplayName(raw: string | null | undefined): string | null {
  if (!raw) return null
  let name = decodeHtml(raw).replace(/\s+/g, " ").trim()
  name = name.replace(/\s*[|–—-]\s*facebook$/i, "").trim()
  if (!name || name.length > 80) return null
  if (!/[a-z]/i.test(name)) return null
  const key = name.toLowerCase()
  if (GENERIC_PAGE_TITLES.has(key)) return null
  if (key.includes("log in") || key.includes("sign up")) return null
  return name
}

function parseUrl(raw: string): URL | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== "https:" && url.protocol !== "http:") return null
    return url
  } catch {
    return null
  }
}

function profileFromUrl(url: URL): ParsedFacebookProfile | null {
  if (!isFacebookHost(url.hostname)) return null
  const segments = url.pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part))

  const idFromQuery = url.searchParams.get("id")?.trim() ?? ""
  if (segments[0] === "profile.php" && /^\d{5,}$/.test(idFromQuery)) {
    return {
      profileUrl: `https://www.facebook.com/profile.php?id=${idFromQuery}`,
      profileId: idFromQuery,
      username: null,
      displayName: null,
    }
  }

  if (segments[0] === "people" && segments.length >= 3 && /^\d{5,}$/.test(segments[2] ?? "")) {
    const profileId = segments[2] ?? ""
    return {
      profileUrl: `https://www.facebook.com/profile.php?id=${profileId}`,
      profileId,
      username: null,
      displayName: peopleSlugToName(segments[1] ?? ""),
    }
  }

  if (segments[0] === "marketplace" && segments[1] === "profile" && /^\d{5,}$/.test(segments[2] ?? "")) {
    const profileId = segments[2] ?? ""
    return {
      profileUrl: `https://www.facebook.com/profile.php?id=${profileId}`,
      profileId,
      username: null,
      displayName: null,
    }
  }

  if (segments.length === 1 && /^\d{5,}$/.test(segments[0] ?? "")) {
    const profileId = segments[0] ?? ""
    return {
      profileUrl: `https://www.facebook.com/profile.php?id=${profileId}`,
      profileId,
      username: null,
      displayName: null,
    }
  }

  const username = segments[0] ?? ""
  if (
    segments.length === 1 &&
    username &&
    !RESERVED_PROFILE_SEGMENTS.has(username.toLowerCase()) &&
    /^[A-Za-z0-9.]{2,50}$/.test(username)
  ) {
    return {
      profileUrl: `https://www.facebook.com/${username}`,
      profileId: null,
      username,
      displayName: null,
    }
  }

  return null
}

export function parseFacebookProfileInput(raw: string): ParsedFacebookProfile | null {
  const trimmed = raw.trim()
  if (/^\d{5,}$/.test(trimmed)) {
    return {
      profileUrl: `https://www.facebook.com/profile.php?id=${trimmed}`,
      profileId: trimmed,
      username: null,
      displayName: null,
    }
  }
  const url = parseUrl(trimmed)
  if (!url) return null
  return profileFromUrl(url)
}

function threadIdFromUrl(url: URL): string | null {
  const queryId =
    url.searchParams.get("thread_id") ??
    url.searchParams.get("tid") ??
    url.searchParams.get("target_thread_id")
  if (queryId && /^\d{6,}$/.test(queryId)) return queryId

  const segments = url.pathname.split("/").filter(Boolean)
  for (let i = 0; i < segments.length; i += 1) {
    const part = segments[i]?.toLowerCase()
    const next = segments[i + 1] ?? ""
    if ((part === "t" || part === "thread") && /^\d{6,}$/.test(next)) return next
  }
  return null
}

export function facebookThreadUrl(threadId: string): string {
  return `https://www.facebook.com/messages/t/${threadId}`
}

export function facebookListingUrl(listingId: string): string {
  return `https://www.facebook.com/marketplace/item/${listingId}/`
}

function listingIdFromUrl(url: URL): string | null {
  const segments = url.pathname.split("/").filter(Boolean)
  for (let i = 0; i < segments.length - 2; i += 1) {
    const section = segments[i]?.toLowerCase()
    const kind = segments[i + 1]?.toLowerCase()
    const id = segments[i + 2] ?? ""
    if (section === "marketplace" && kind === "item" && /^\d{6,}$/.test(id)) return id
  }
  return null
}

/**
 * Listing ids are shared by every buyer on one item, so the stored key includes
 * the profile. Messenger thread ids are already one conversation.
 */
export function facebookThreadStorageId(
  thread: ParsedFacebookThread,
  profile: ParsedFacebookProfile,
): string {
  if (!thread.listingId) return thread.threadId
  const owner = profile.profileId ?? profile.username
  return owner ? `listing:${thread.listingId}:${owner}` : `listing:${thread.listingId}`
}

export function facebookThreadCaption(threadId: string): string {
  const listing = /^listing:(\d+)(?::|$)/.exec(threadId)
  if (listing?.[1]) return `Listing ${listing[1]}`
  return `Thread ${threadId}`
}

export function parseFacebookThreadInput(raw: string): ParsedFacebookThread | null {
  const trimmed = raw.trim()
  if (/^\d{6,}$/.test(trimmed)) {
    return { threadId: trimmed, threadUrl: facebookThreadUrl(trimmed), listingId: null }
  }
  const url = parseUrl(trimmed)
  if (!url) return null
  if (!isFacebookHost(url.hostname) && !isMessengerHost(url.hostname)) return null
  const threadId = threadIdFromUrl(url)
  if (threadId) return { threadId, threadUrl: facebookThreadUrl(threadId), listingId: null }
  const listingId = listingIdFromUrl(url)
  if (!listingId) return null
  return { threadId: listingId, threadUrl: facebookListingUrl(listingId), listingId }
}

function metaContent(html: string, attr: "property" | "name", key: string): string | null {
  const pattern = new RegExp(
    `<meta[^>]+${attr}=["']${key}["'][^>]*content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]*${attr}=["']${key}["']`,
    "i",
  )
  const match = html.match(pattern)
  const value = match?.[1] ?? match?.[2] ?? null
  return value ? decodeHtml(value).trim() : null
}

export function extractPublicFacebookName(html: string): string | null {
  const sliced = html.slice(0, 250_000)
  const fromMeta =
    metaContent(sliced, "property", "og:title") ?? metaContent(sliced, "name", "twitter:title")
  const metaName = usableDisplayName(fromMeta)
  if (metaName) return metaName

  const title = sliced.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
  return usableDisplayName(title)
}

export function splitLeadName(label: string): { firstName: string; lastName: string | null } {
  const parts = label.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: CRM_FACEBOOK_PLACEHOLDER_FIRST_NAME, lastName: null }
  if (parts.length === 1) {
    const only = parts[0] ?? CRM_FACEBOOK_PLACEHOLDER_FIRST_NAME
    return { firstName: only.slice(0, 80), lastName: null }
  }
  return {
    firstName: (parts[0] ?? CRM_FACEBOOK_PLACEHOLDER_FIRST_NAME).slice(0, 80),
    lastName: parts.slice(1).join(" ").slice(0, 80),
  }
}

export function leadNameFromFacebook(input: {
  parsed: ParsedFacebookProfile
  publicName: string | null
}): { firstName: string; lastName: string | null; displayName: string } {
  const publicName = usableDisplayName(input.publicName)
  const fromUrl = usableDisplayName(input.parsed.displayName)
  const usernameLabel = input.parsed.username?.replace(/[._]+/g, " ").trim() || null
  const label = publicName ?? fromUrl ?? (usernameLabel && /[a-z]/i.test(usernameLabel) ? usernameLabel : null)
  if (!label) {
    const tail = input.parsed.profileId?.slice(-6)
    const displayName = tail ? `Facebook ${tail}` : "Facebook lead"
    return {
      firstName: CRM_FACEBOOK_PLACEHOLDER_FIRST_NAME,
      lastName: null,
      displayName,
    }
  }
  const parts = splitLeadName(label)
  return {
    ...parts,
    displayName: [parts.firstName, parts.lastName].filter(Boolean).join(" "),
  }
}

export function facebookNameIsAutomatic(
  contact: { first_name: string; last_name: string | null; facebook_username: string | null },
  previousDisplayName: string | null,
): boolean {
  if (contact.first_name === CRM_FACEBOOK_PLACEHOLDER_FIRST_NAME && !contact.last_name) return true
  const stored = [contact.first_name, contact.last_name].filter(Boolean).join(" ")
  if (previousDisplayName && stored === previousDisplayName) return true
  const usernameLabel = contact.facebook_username?.replace(/[._]+/g, " ").trim()
  if (usernameLabel && stored.toLowerCase() === usernameLabel.toLowerCase()) return true
  return false
}

export function addDaysIso(days: number, from = Date.now()): string {
  return new Date(from + days * 86_400_000).toISOString()
}
