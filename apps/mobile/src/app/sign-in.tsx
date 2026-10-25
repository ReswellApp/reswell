import { useRouter } from "expo-router"
import { useEffect, useRef } from "react"
import { useAuthGate } from "@/lib/auth-gate"

/** Older links open the shared sign-in sheet instead of a full-screen form. */
export default function SignInScreen() {
  const router = useRouter()
  const { requestAuth } = useAuthGate()
  const opened = useRef(false)

  useEffect(() => {
    if (opened.current) return
    opened.current = true
    requestAuth()
    if (router.canGoBack()) router.back()
    else router.replace("/")
  }, [requestAuth, router])

  return null
}
