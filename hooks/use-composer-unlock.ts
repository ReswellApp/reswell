"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type ComposerUnlockRequest =
  | { scope: "marketplace" }
  | { scope: "live-chat"; visitorToken: string; publicId?: string | null }

const REFRESH_MARGIN_MS = 30_000

function requestKey(request: ComposerUnlockRequest | null): string | null {
  if (!request) return null
  if (request.scope === "marketplace") return "marketplace"
  return `live-chat:${request.visitorToken}:${request.publicId ?? ""}`
}

async function fetchUnlockToken(
  request: ComposerUnlockRequest,
): Promise<{ token: string; expiresAt: number } | null> {
  const body =
    request.scope === "marketplace"
      ? { scope: "marketplace" }
      : {
          scope: "live-chat",
          visitor_token: request.visitorToken,
          public_id: request.publicId || undefined,
        }

  const res = await fetch("/api/composer-unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) return null
  const json = (await res.json()) as {
    data?: { token?: string; expires_at?: number }
  }
  const token = json.data?.token?.trim()
  const expiresAt = json.data?.expires_at
  if (!token || typeof expiresAt !== "number") return null
  return { token, expiresAt }
}

export function useComposerUnlock(request: ComposerUnlockRequest | null): {
  token: string | null
  ready: boolean
  failed: boolean
  refresh: () => Promise<string | null>
  ensure: () => Promise<string | null>
} {
  const [token, setToken] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const tokenRef = useRef<string | null>(null)
  const requestRef = useRef(request)
  requestRef.current = request
  const key = requestKey(request)

  const refresh = useCallback(async (): Promise<string | null> => {
    const current = requestRef.current
    if (!current) return null
    try {
      const issued = await fetchUnlockToken(current)
      tokenRef.current = issued?.token ?? null
      setToken(tokenRef.current)
      setFailed(!issued)
      return tokenRef.current
    } catch {
      tokenRef.current = null
      setToken(null)
      setFailed(true)
      return null
    }
  }, [])

  const ensure = useCallback(async (): Promise<string | null> => {
    if (tokenRef.current) return tokenRef.current
    return refresh()
  }, [refresh])

  useEffect(() => {
    tokenRef.current = null
    setToken(null)
    setFailed(false)
    if (!key) return

    let cancelled = false
    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    async function load(attempt = 0) {
      const current = requestRef.current
      if (!current || cancelled) return
      try {
        const issued = await fetchUnlockToken(current)
        if (cancelled) return
        if (!issued) {
          tokenRef.current = null
          setToken(null)
          if (attempt < 1) {
            retryTimer = setTimeout(() => void load(attempt + 1), 3000)
            return
          }
          setFailed(true)
          return
        }
        tokenRef.current = issued.token
        setToken(issued.token)
        setFailed(false)
        const waitMs = Math.max(5_000, issued.expiresAt - Date.now() - REFRESH_MARGIN_MS)
        refreshTimer = setTimeout(() => void load(0), waitMs)
      } catch {
        if (cancelled) return
        tokenRef.current = null
        setToken(null)
        if (attempt < 1) {
          retryTimer = setTimeout(() => void load(attempt + 1), 3000)
          return
        }
        setFailed(true)
      }
    }

    void load(0)
    return () => {
      cancelled = true
      if (refreshTimer) clearTimeout(refreshTimer)
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [key])

  return {
    token,
    ready: token != null,
    failed,
    refresh,
    ensure,
  }
}
