"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { LoginFormPanel } from "@/components/auth/login-form-panel"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

function LoginForm() {
  const searchParams = useSearchParams()
  const redirectTo = safeRedirectPath(searchParams.get("redirect"))
  return <LoginFormPanel redirectTo={redirectTo} variant="page" />
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
          <div className="w-full max-w-sm">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Welcome back</CardTitle>
                <CardDescription>Loading...</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-10 bg-lightgray animate-pulse rounded-md" />
                <div className="mt-4 h-10 bg-lightgray animate-pulse rounded-md" />
                <div className="mt-4 h-10 bg-black rounded-md" />
              </CardContent>
            </Card>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
