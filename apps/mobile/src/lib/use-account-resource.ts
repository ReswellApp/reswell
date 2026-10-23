import { useFocusEffect } from "expo-router"
import { useCallback, useState } from "react"
import { useAuth } from "@/lib/auth-context"

export function useAccountResource<T>(load: (accessToken: string) => Promise<T>) {
  const { session } = useAuth()
  const token = session?.access_token ?? null
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    let cancelled = false
    if (!token) {
      setData(null)
      setError("Sign in required")
      setLoading(false)
      return () => {
        cancelled = true
      }
    }
    setLoading(true)
    load(token)
      .then((next) => {
        if (!cancelled) {
          setData(next)
          setError(null)
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setData(null)
          setError(cause instanceof Error ? cause.message : "Unable to load")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [load, token])

  useFocusEffect(reload)
  return { data, error, loading, reload }
}
