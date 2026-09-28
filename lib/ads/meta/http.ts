import "server-only"

import { AdsPlatformError } from "@/lib/ads/manager/errors"
import { assertMetaAdsConfigured, getMetaGraphVersion } from "@/lib/ads/meta/config"

interface MetaPage<T> {
  data?: T[]
  paging?: { next?: string }
}

interface MetaErrorBody {
  error?: { message?: string }
}

export async function metaGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const { accessToken } = assertMetaAdsConfigured()
  const url = new URL(`https://graph.facebook.com/${getMetaGraphVersion()}/${path}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return metaFetch<T>(url.toString(), accessToken)
}

export async function metaGetAll<T>(path: string, params: Record<string, string>): Promise<{ rows: T[]; truncated: boolean }> {
  const { accessToken } = assertMetaAdsConfigured()
  const url = new URL(`https://graph.facebook.com/${getMetaGraphVersion()}/${path}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  const rows: T[] = []
  let next: string | null = url.toString()
  let truncated = false
  for (let page = 0; page < 5 && next; page += 1) {
    const payload: MetaPage<T> = await metaFetch<MetaPage<T>>(next, accessToken)
    rows.push(...(payload.data ?? []))
    next = payload.paging?.next ?? null
    if (rows.length >= 400) {
      truncated = rows.length > 400 || Boolean(next)
      break
    }
  }
  return { rows: rows.slice(0, 400), truncated }
}

export async function metaPostForm(path: string, body: Record<string, string>): Promise<unknown> {
  const { accessToken } = assertMetaAdsConfigured()
  const url = `https://graph.facebook.com/${getMetaGraphVersion()}/${path}`
  return metaFetch<unknown>(url, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  })
}

export async function metaPost(path: string, body: Record<string, unknown>): Promise<{ id?: string }> {
  const { accessToken } = assertMetaAdsConfigured()
  const url = `https://graph.facebook.com/${getMetaGraphVersion()}/${path}`
  return metaFetch<{ id?: string }>(url, accessToken, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export async function metaDelete(path: string): Promise<void> {
  const { accessToken } = assertMetaAdsConfigured()
  const url = `https://graph.facebook.com/${getMetaGraphVersion()}/${path}`
  await metaFetch<unknown>(url, accessToken, { method: "DELETE" })
}

async function metaFetch<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const parsed = new URL(url)
  parsed.searchParams.delete("access_token")
  const headers = new Headers(init?.headers)
  headers.set("Authorization", `Bearer ${accessToken}`)
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json")
  const response = await fetch(parsed, {
    ...init,
    headers,
    signal: AbortSignal.timeout(20_000),
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      payload && typeof payload === "object"
        ? (payload as MetaErrorBody).error?.message
        : null
    throw new AdsPlatformError(message?.trim() || `Meta Ads request failed (${response.status})`, "meta")
  }
  return (payload ?? {}) as T
}
