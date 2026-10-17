import {
  getGoogleMerchantContentLanguage,
  getGoogleMerchantFeedLabel,
  getGoogleMerchantParentAccount,
} from "./config"

/** Resource name for productInputs.delete, e.g. accounts/123/productInputs/en~US~offer-id */
export function buildProductInputResourceName(offerId: string, feedLabel?: string): string {
  const parent = getGoogleMerchantParentAccount()
  const language = getGoogleMerchantContentLanguage()
  const label = feedLabel?.trim() || getGoogleMerchantFeedLabel()
  return `${parent}/productInputs/${language}~${label}~${offerId}`
}
