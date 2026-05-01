"use client"

import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  UpdatePasswordFormFields,
  UpdatePasswordInvalidSessionActions,
} from "@/components/auth/update-password-form-fields"

export function UpdatePasswordFormPanel() {
  const [hasSession, setHasSession] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setHasSession(!!user)
    })
  }, [])

  if (hasSession === null) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Set new password</CardTitle>
              <CardDescription>Loading…</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    )
  }

  if (!hasSession) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Link expired or invalid</CardTitle>
              <CardDescription>
                Open the reset link from your email again, or request a new one.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UpdatePasswordInvalidSessionActions />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Set new password</CardTitle>
            <CardDescription>
              Choose a strong password you haven&apos;t used elsewhere.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UpdatePasswordFormFields />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
