"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { SignUpFormPanel } from "@/components/auth/sign-up-form-panel"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

function SignUpForm() {
  const searchParams = useSearchParams()
  const redirectTo = safeRedirectPath(searchParams.get("redirect"))
  return <SignUpFormPanel variant="page" redirectTo={redirectTo} />
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
          <div className="w-full max-w-sm">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Join Reswell</CardTitle>
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
      <SignUpForm />
    </Suspense>
  )
}
