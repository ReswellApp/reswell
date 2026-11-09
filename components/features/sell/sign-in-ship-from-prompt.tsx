"use client"

import { useCallback, useEffect, useState } from "react"
import { usePathname } from "next/navigation"

import {
  SignInShipFromDialog,
  type SignInShipFromDialogPrompt,
} from "@/components/features/sell/sign-in-ship-from-dialog"
import { getSignInShipFromPrompt } from "@/lib/actions/sellerShipFromActions"
import { getImpersonation } from "@/lib/impersonation"
import { signInShipFromDismissStorageKey } from "@/lib/services/signInShipFromPrompt"
import { createClient } from "@/lib/supabase/client"

function hiddenPath(pathname: string | null): boolean {
  if (!pathname) return true
  return (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/embed") ||
    pathname.startsWith("/coastal-delivery") ||
    pathname === "/sell" ||
    pathname.startsWith("/sell/")
  )
}

export function SignInShipFromPrompt() {
  const pathname = usePathname()
  const [prompt, setPrompt] = useState<SignInShipFromDialogPrompt | null>(null)
  const [dismissKey, setDismissKey] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [impersonating, setImpersonating] = useState(false)

  const load = useCallback(async () => {
    if (getImpersonation()) {
      setImpersonating(true)
      setPrompt(null)
      return
    }
    setImpersonating(false)
    const supabase = createClient()
    const { data } = await supabase.auth.getUser()
    const user = data.user
    if (!user) {
      setPrompt(null)
      setDismissKey(null)
      setDismissed(false)
      return
    }

    const key = signInShipFromDismissStorageKey(user.id, user.last_sign_in_at)
    setDismissKey(key)
    setDismissed(window.sessionStorage.getItem(key) === "1")

    const result = await getSignInShipFromPrompt()
    if (!result.shouldPrompt) {
      setPrompt(null)
      return
    }

    setPrompt({
      needsFullName: result.needsFullName,
      needsPhone: result.needsPhone,
      addressId: result.addressId,
      title: result.title,
      description: result.description,
      detail: result.detail,
      prefill: result.prefill,
    })
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        void load()
      }
    })
    return () => subscription.unsubscribe()
  }, [load])

  const open = Boolean(prompt) && !dismissed && !impersonating && !hiddenPath(pathname)

  if (!prompt) return null

  return (
    <SignInShipFromDialog
      open={open}
      prompt={prompt}
      onDismiss={() => {
        if (dismissKey) window.sessionStorage.setItem(dismissKey, "1")
        setDismissed(true)
      }}
      onSaved={() => {
        setPrompt(null)
      }}
    />
  )
}
