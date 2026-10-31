import type { MobileSellEditLoad } from "@reswell/api-contract"
import type { SellDraft, SellPhoto, SellVideo } from "@/lib/sell-flow"

export function sellDraftFromMobileEdit(payload: MobileSellEditLoad): SellDraft {
  const photos: SellPhoto[] = payload.images.map((image, index) => ({
    id: image.image_id ?? `photo-${index}`,
    uri: image.url,
    url: image.url,
    thumbnailUrl: image.thumbnail_url,
    serverImageId: image.image_id,
  }))
  const firstVideo = payload.videos[0]
  const video: SellVideo | null = firstVideo?.url
    ? {
        id: firstVideo.video_id ?? "listing-video",
        uri: firstVideo.thumbnail_url || firstVideo.url,
        url: firstVideo.url,
        thumbnailUrl: firstVideo.thumbnail_url ?? null,
        thumbnailUri: firstVideo.thumbnail_url ?? null,
        contentType: firstVideo.content_type ?? null,
        durationSeconds: firstVideo.duration_seconds ?? null,
        byteSize: firstVideo.byte_size ?? null,
        serverVideoId: firstVideo.video_id,
        status: "ready",
      }
    : null

  return {
    photos,
    video,
    title: payload.title,
    brand: payload.brand,
    model: payload.model,
    brandId: "",
    brandModelId: "",
    linkedBrandName: "",
    category: payload.category,
    subcategory: payload.subcategory,
    condition: payload.condition,
    description: payload.description,
    price: payload.price != null && payload.price > 0 ? String(payload.price) : "",
    locationLabel: payload.location_label ?? "",
    city: payload.city,
    state: payload.state,
    locationLat: payload.location_lat,
    locationLng: payload.location_lng,
    localPickup: payload.local_pickup,
    shipping: payload.shipping,
    shippingMode: payload.shipping_mode,
    shippingPrice:
      payload.shipping_price != null && payload.shipping_price >= 0 ? String(payload.shipping_price) : "",
    packageLength: payload.package_length,
    packageWidth: payload.package_width,
    packageHeight: payload.package_height,
    packageWeightLb: payload.package_weight_lb,
    packageWeightOz: payload.package_weight_oz,
    dropoffLocationId: payload.dropoff_location_id ?? "",
    serverDraftId: payload.listing_id,
    specs: { ...payload.specs },
  }
}
