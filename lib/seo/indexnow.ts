/** IndexNow payload builder. Bing (and ChatGPT Search) recrawl submitted URLs. */

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"
export const INDEXNOW_KEY_PATH = "/indexnow-key.txt"

const INDEXNOW_KEY_PATTERN = /^[A-Za-z0-9-]{8,128}$/

export type IndexNowSubmission = {
  endpoint: string
  body: {
    host: string
    key: string
    keyLocation: string
    urlList: string[]
  }
}

/** IndexNow keys are 8–128 characters: letters, numbers, and dashes. */
export function readIndexNowKey(raw: string | null | undefined): string | null {
  const key = raw?.trim() ?? ""
  if (!INDEXNOW_KEY_PATTERN.test(key)) return null
  return key
}

export function buildIndexNowSubmission(input: {
  origin: string
  key: string
  urls: string[]
}): IndexNowSubmission | null {
  const key = readIndexNowKey(input.key)
  const urls = [...new Set(input.urls.map((url) => url.trim()).filter(Boolean))].slice(0, 10_000)
  if (!key || urls.length === 0) return null

  let host: string
  let origin: string
  try {
    const parsed = new URL(input.origin)
    host = parsed.host
    origin = `${parsed.protocol}//${parsed.host}`
  } catch {
    return null
  }

  return {
    endpoint: INDEXNOW_ENDPOINT,
    body: {
      host,
      key,
      keyLocation: `${origin}${INDEXNOW_KEY_PATH}`,
      urlList: urls,
    },
  }
}
