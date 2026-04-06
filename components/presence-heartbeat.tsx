'use client'

import { useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updatePresenceHeartbeat } from '@/app/actions/account'

const INTERVAL_MS = 60_000

async function ping() {
  try {
    await updatePresenceHeartbeat()
  } catch {
    // ignore network errors
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
      void ping()
      intervalRef.current = setInterval(() => {
        void ping()
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
