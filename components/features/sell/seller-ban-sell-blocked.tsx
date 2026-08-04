import { SellerBanRestrictedPanel } from "@/components/features/sell/seller-ban-restricted-panel"

/** Full-page sell gate when the signed-in user is seller-banned. */
export function SellerBanSellBlocked() {
  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-lg flex-col justify-center px-4 py-16">
      <SellerBanRestrictedPanel />
    </div>
  )
}
