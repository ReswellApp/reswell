"use server"

import { cookies } from "next/headers"
import { GOOGLE_NEW_SIGNUP_COOKIE } from "@/lib/auth/google-sign-up-welcome"

export async function clearGoogleNewSignupCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(GOOGLE_NEW_SIGNUP_COOKIE, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
  })
}
