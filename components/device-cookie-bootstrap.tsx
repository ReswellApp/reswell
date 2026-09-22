"use client"

import { useEffect } from "react"

const SESSION_FLAG = "rw_did_beacon"

/**
 * `rw_did` is httpOnly, so the document cannot see it. One POST per tab lets
 * the API set it without putting `Set-Cookie` on cached HTML.
 */
export function DeviceCookieBootstrap() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_FLAG) === "1") return
    } catch {
      // Private mode can throw. Still attempt the beacon once.
    }

    void fetch("/api/device", { method: "POST", credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) return
        try {
          sessionStorage.setItem(SESSION_FLAG, "1")
        } catch {
          // Ignore storage failures. The cookie is still set.
        }
      })
      .catch(() => {
        // A later navigation through a non-cached route sets the cookie in proxy.
      })
  }, [])

  return null
}
