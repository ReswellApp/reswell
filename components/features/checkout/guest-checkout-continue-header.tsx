"use client"

import { GoogleOAuthButton } from "@/components/auth/google-oauth-button"

export function GuestCheckoutContinueHeader({ checkoutPath }: { checkoutPath: string }) {
  return (
    <div className="mb-10 space-y-6">
      <div className="space-y-1">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Continue with</h2>
        <p className="text-[13px] text-neutral-500">Sign in with Google for faster checkout and order history.</p>
      </div>
      <GoogleOAuthButton nextPath={checkoutPath} className="w-full" />
      <div className="relative flex items-center justify-center py-1">
        <div className="absolute inset-x-0 top-1/2 h-px bg-neutral-200" aria-hidden />
        <span className="relative bg-white px-3 text-xs font-medium uppercase tracking-wide text-neutral-400">or</span>
      </div>
      <div className="space-y-1">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Guest checkout</h2>
        <p className="text-[13px] text-neutral-500">Checkout without creating a password — we&apos;ll email your receipt.</p>
      </div>
    </div>
  )
}
