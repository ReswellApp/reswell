'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Mail, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

function SignUpSuccessContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''
  const [resending, setResending] = useState(false)

  async function handleResend() {
    if (!email) {
      toast.error('No email address to resend to')
      return
    }
    setResending(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      })
      if (error) throw error
      toast.success('Confirmation email sent again. Check your inbox.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to resend email')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-muted/30">
      <div className="w-full max-w-md">
        <Card className="border-0 shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-2xl">Check your email</CardTitle>
            <CardDescription className="text-base">
              We sent a confirmation link to
              {email ? (
                <span className="mt-1 block font-medium text-foreground">{email}</span>
              ) : (
                ' your email address'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground text-center">
              Click the link in that email to confirm your account and start using Reswell.
            </p>
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="text-xs text-muted-foreground">
                Didn’t receive the email? Check your spam folder, or we can send it again.
              </p>
              {email && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={handleResend}
                  disabled={resending}
                >
                  {resending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Resend confirmation email'
                  )}
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Button asChild className="w-full">
                <Link href="/auth/login">Back to sign in</Link>
              </Button>
              <Button variant="ghost" asChild className="w-full">
                <Link href="/">Go to homepage</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function SignUpSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SignUpSuccessContent />
    </Suspense>
  )
}
