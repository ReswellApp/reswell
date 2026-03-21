'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const INTERVAL_MS = 60_000

async function ping() {
  try {
    await fetch('/api/presence', { method: 'POST', credentials: 'include' })
  } catch {
    // ignore network errors
  }
}

export function PresenceHeartbeat() {
  const supabase = createClient()
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

    void startIfSignedIn()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void startIfSignedIn()
    })

    return () => {
      subscription.unsubscribe()
      clear()
    }
  }, [supabase])

  return null
}
