import { extractPublicFacebookName, type ParsedFacebookProfile } from "@/lib/utils/facebookLead"

const LOOKUP_TIMEOUT_MS = 1800

function mbasicUrl(profileUrl: string): string | null {
  try {
    const url = new URL(profileUrl)
    url.protocol = "https:"
    url.hostname = "mbasic.facebook.com"
    return url.toString()
  } catch {
    return null
  }
}

async function readPublicName(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      redirect: "follow",
      headers: {
        Accept: "text/html",
        "User-Agent": "Mozilla/5.0 (compatible; ReswellCRM/1.0; +https://reswell.com)",
      },
    })
    if (!response.ok) return null
    const html = (await response.text()).slice(0, 250_000)
    return extractPublicFacebookName(html)
  } catch {
    return null
  }
}

/**
 * Best-effort public name. Facebook often returns a login wall; callers still
 * save the lead from the URL when this comes back empty.
 */
export async function lookupFacebookPublicName(profile: ParsedFacebookProfile): Promise<string | null> {
  const urls = [profile.profileUrl, mbasicUrl(profile.profileUrl)].filter((url): url is string => Boolean(url))
  const names = await Promise.all(urls.map((url) => readPublicName(url)))
  return names.find((name): name is string => Boolean(name)) ?? null
}
