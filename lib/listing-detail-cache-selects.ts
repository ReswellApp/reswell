import { LISTING_SELLER_PROFILES_EMBED } from "@/lib/db/listing-seller-profile-embed"

export const LISTING_META_SELECT =
  "id, slug, title, description, status, price, listing_images (url, is_primary, sort_order), categories (name, slug), section, user_id, hidden_from_site"

export const LISTING_ROUTE_SHELL_SELECT = "id, section, slug, user_id, hidden_from_site"

export const SURFBOARD_LISTING_SELECT = `
        *,
        listing_images (id, url, thumbnail_url, is_primary, sort_order),
        ${LISTING_SELLER_PROFILES_EMBED} (id, seller_slug, is_shop, shop_name, shop_logo_url, display_name, avatar_url, location, created_at, shop_verified, sales_count, follower_count)
      `

export const SHOP_LISTING_SELECT = `
      id,
      title,
      description,
      price,
      status,
      user_id,
      views,
      created_at,
      listing_images (url, is_primary),
      stock_quantity,
      categories (name)
    `
