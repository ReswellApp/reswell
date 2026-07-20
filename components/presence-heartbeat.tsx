'use client'

import { useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isAbortError, isBenignClientFetchError } from '@/lib/utils/is-abort-error'

const INTERVAL_MS = 60_000

function isBenignPresenceError(err: unknown): boolean {
  return isAbortError(err) || isBenignClientFetchError(err)
}

async function ping() {
  try {
    const res = await fetch('/api/presence/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    })
    // 401 = signed out mid-session; stop quietly until auth listener restarts.
    if (res.status === 401) return
    if (!res.ok && res.status >= 500) {
      console.warn('[presence] heartbeat failed', res.status)
    }
  } catch (err) {
    if (isBenignPresenceError(err)) return
  }
}

export function PresenceHeartbeat() {
  const supabase = useMemo(() => createClient(), [])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    function clear() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    async function startIfSignedIn() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      clear()
      if (!user) return
      void ping().catch((err) => {
        if (!isBenignPresenceError(err)) return
      })
      intervalRef.current = setInterval(() => {
        void ping().catch((err) => {
          if (!isBenignPresenceError(err)) return
        })
      }, INTERVAL_MS)
    }

    let subscription: { unsubscribe: () => void } | null = null

    // Defer setup by 5 s so presence polling doesn't compete with initial page
    // hydration and layout/paint. Auth state changes are still caught once the
    // listener is registered.
    const startupTimeout = setTimeout(() => {
      void startIfSignedIn()
      const { data } = supabase.auth.onAuthStateChange(() => {
        void startIfSignedIn()
      })
      subscription = data.subscription
    }, 5_000)

    return () => {
      clearTimeout(startupTimeout)
      subscription?.unsubscribe()
      clear()
    }
  }, [supabase])

  return null
}
