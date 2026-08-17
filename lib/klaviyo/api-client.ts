/**
 * Server-only: shared Klaviyo REST GET helper (private API key).
 * @see https://developers.klaviyo.com/en/reference/api-overview
 */

import "@/lib/klaviyo/bootstrap-env"
import { KLAVIYO_API_REVISION } from "@/lib/klaviyo/send-event"

const KLAVIYO_API_BASE = "https://a.klaviyo.com"

export type KlaviyoGetResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; detail: string; missingKey?: boolean }

export function getKlaviyoApiKey(): string | null {
  const key = process.env.KLAVIYO_API_KEY?.trim()
  return key && key.length > 0 ? key : null
}

function klaviyoHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    revision: KLAVIYO_API_REVISION,
    Accept: "application/vnd.api+json",
  }
}

/**
 * GET a Klaviyo JSON:API path (e.g. `/api/flows` or a full `https://a.klaviyo.com/...` next link).
 */
export async function klaviyoGet<T>(
  pathOrUrl: string,
  searchParams?: Record<string, string>,
): Promise<KlaviyoGetResult<T>> {
  const apiKey = getKlaviyoApiKey()
  if (!apiKey) {
    return {
      ok: false,
      status: 0,
      detail: "KLAVIYO_API_KEY not set",
      missingKey: true,
    }
  }

  let url: URL
  try {
    url = pathOrUrl.startsWith("http")
      ? new URL(pathOrUrl)
      : new URL(pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`, KLAVIYO_API_BASE)
  } catch {
    return { ok: false, status: 0, detail: `Invalid Klaviyo URL: ${pathOrUrl}` }
  }

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value)
    }
  }

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: klaviyoHeaders(apiKey),
      cache: "no-store",
    })
    const text = await res.text().catch(() => "")
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        detail: text.slice(0, 800) || res.statusText,
      }
    }

    let data: T
    try {
      data = JSON.parse(text) as T
    } catch {
      return {
        ok: false,
        status: res.status,
        detail: "Invalid JSON from Klaviyo",
      }
    }

    return { ok: true, status: res.status, data }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, status: 0, detail: msg }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * GET with retries on 429 / 5xx (Klaviyo rate limits).
 */
export async function klaviyoGetWithRetry<T>(
  pathOrUrl: string,
  searchParams?: Record<string, string>,
  opts?: { maxAttempts?: number },
): Promise<KlaviyoGetResult<T>> {
  const maxAttempts = opts?.maxAttempts ?? 5
  let last: KlaviyoGetResult<T> | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    last = await klaviyoGet<T>(pathOrUrl, searchParams)
    if (last.ok) return last
    if (last.missingKey) return last

    const retriable = last.status === 429 || last.status >= 500
    if (!retriable || attempt === maxAttempts) return last

    // Prefer ~400ms * attempt; stay under burst while recovering from 429.
    await sleep(400 * attempt)
  }

  return last ?? { ok: false, status: 0, detail: "Klaviyo request failed" }
}

type KlaviyoCollectionPage<TItem, TIncluded = unknown> = {
  data: TItem[]
  included?: TIncluded[]
  links?: { next?: string | null; self?: string }
}

/**
 * Paginate a Klaviyo collection endpoint until `links.next` is exhausted.
 */
export async function klaviyoGetAllPages<TItem>(
  path: string,
  searchParams?: Record<string, string>,
  opts?: { maxPages?: number },
): Promise<KlaviyoGetResult<TItem[]>> {
  const result = await klaviyoGetAllPagesWithIncluded<TItem, never>(path, searchParams, opts)
  if (!result.ok) return result
  return { ok: true, status: 200, data: result.data.items }
}

/**
 * Paginate a compound document, accumulating primary `data` and `included` resources.
 */
export async function klaviyoGetAllPagesWithIncluded<TItem, TIncluded>(
  path: string,
  searchParams?: Record<string, string>,
  opts?: { maxPages?: number },
): Promise<KlaviyoGetResult<{ items: TItem[]; included: TIncluded[] }>> {
  const maxPages = opts?.maxPages ?? 50
  const items: TItem[] = []
  const included: TIncluded[] = []
  let next: string | null = null
  let page = 0

  const first = await klaviyoGet<KlaviyoCollectionPage<TItem, TIncluded>>(path, searchParams)
  if (!first.ok) return first

  items.push(...(first.data.data ?? []))
  if (first.data.included?.length) included.push(...first.data.included)
  next = first.data.links?.next ?? null
  page += 1

  while (next && page < maxPages) {
    const pageResult = await klaviyoGet<KlaviyoCollectionPage<TItem, TIncluded>>(next)
    if (!pageResult.ok) return pageResult
    items.push(...(pageResult.data.data ?? []))
    if (pageResult.data.included?.length) included.push(...pageResult.data.included)
    next = pageResult.data.links?.next ?? null
    page += 1
  }

  return { ok: true, status: 200, data: { items, included } }
}

/**
 * Run async work over items with a fixed concurrency limit (for Klaviyo rate limits).
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const limit = Math.max(1, concurrency)
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    for (;;) {
      const i = nextIndex
      nextIndex += 1
      if (i >= items.length) return
      results[i] = await fn(items[i]!, i)
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length || 1) }, () => worker())
  await Promise.all(workers)
  return results
}
