/**
 * Facebook Marketplace bulk-upload category paths from the official template
 * (`Marketplace_Bulk_Upload_Template.xlsx` VALIDATION sheet).
 */

export const FACEBOOK_MARKETPLACE_BULK_UPLOAD_MAX = 50

export const FACEBOOK_MARKETPLACE_TITLE_MAX = 150

export const FACEBOOK_MARKETPLACE_DESCRIPTION_MAX = 5000

export const FACEBOOK_MARKETPLACE_CONDITIONS = [
  "New",
  "Used - Like New",
  "Used - Good",
  "Used - Fair",
] as const

export type FacebookMarketplaceCondition = (typeof FACEBOOK_MARKETPLACE_CONDITIONS)[number]

export const FACEBOOK_MARKETPLACE_CATEGORY = {
  surfboards:
    "Sporting Goods//Outdoor Recreation//Water Sports & Boating//Surfing//Surfboards",
  bodyboards:
    "Sporting Goods//Outdoor Recreation//Water Sports & Boating//Surfing//Bodyboards",
  skimboards:
    "Sporting Goods//Outdoor Recreation//Water Sports & Boating//Surfing//Skimboards",
  surfingAccessories:
    "Sporting Goods//Outdoor Recreation//Water Sports & Boating//Surfing//Surfing Accessories",
  swimmingFins:
    "Sporting Goods//Outdoor Recreation//Water Sports & Boating//Swimming//Swimming Fins",
  wetsuits:
    "Sporting Goods//Outdoor Recreation//Water Sports & Boating//Water Sport Apparel & Accessories//Wetsuits",
  rashGuards:
    "Sporting Goods//Outdoor Recreation//Water Sports & Boating//Water Sport Apparel & Accessories//Rash Guards",
  magazines: "Books, Movies & Music//Magazines & Catalogs",
} as const

export type FacebookMarketplaceCategory =
  (typeof FACEBOOK_MARKETPLACE_CATEGORY)[keyof typeof FACEBOOK_MARKETPLACE_CATEGORY]
