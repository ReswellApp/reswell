import {
  getGoogleMerchantContentLanguage,
  getGoogleMerchantFeedLabel,
  getGoogleMerchantParentAccount,
} from "./config"

/** Resource name for productInputs.delete, e.g. accounts/123/productInputs/en~US~offer-id */
export function buildProductInputResourceName(offerId: string): string {
  const parent = getGoogleMerchantParentAccount()
  const language = getGoogleMerchantContentLanguage()
  const feedLabel = getGoogleMerchantFeedLabel()
  return `${parent}/productInputs/${language}~${feedLabel}~${offerId}`
}
