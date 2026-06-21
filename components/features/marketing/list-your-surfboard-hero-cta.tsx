"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useOptionalAuthModal } from "@/components/auth/auth-modal-context"
import { MadeWithLoveSantaBarbara } from "@/components/made-with-love-santa-barbara"
import {
  LIST_YOUR_SURFBOARD_SELL_HREF,
  ListYourSurfboardSellCta,
} from "@/components/features/marketing/list-your-surfboard-sell-cta"

type ListYourSurfboardHeroCtaProps = {
  isLoggedIn: boolean
}

export function ListYourSurfboardHeroCta({ isLoggedIn }: ListYourSurfboardHeroCtaProps) {
  const authModal = useOptionalAuthModal()
  const router = useRouter()

  function handleSignUpClick() {
    if (authModal) {
      authModal.openSignUp(LIST_YOUR_SURFBOARD_SELL_HREF)
      return
    }
    router.push(
      `/auth/sign-up?redirect=${encodeURIComponent(LIST_YOUR_SURFBOARD_SELL_HREF)}`,
    )
  }

  return (
    <div className="mx-auto mt-2 max-w-xl rounded-2xl border border-border/70 bg-white px-5 py-5 text-center shadow-soft sm:px-6 sm:py-6">
      <p className="text-balance text-sm text-muted-foreground sm:text-base">
        Our mission is to make buying and selling surfboards simple, trusted, and genuinely
        enjoyable.
      </p>
      <div className="mt-4 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        <ListYourSurfboardSellCta className="w-full sm:w-auto">List your surfboard</ListYourSurfboardSellCta>
        {!isLoggedIn ? (
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={handleSignUpClick}
          >
            Sign up
          </Button>
        ) : null}
      </div>
      <MadeWithLoveSantaBarbara variant="light" className="mt-4 w-full" />
    </div>
  )
}
