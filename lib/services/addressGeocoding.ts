import {
  googleResolveStreetAddress,
  type GoogleResolvedStreet,
} from "@/lib/maps/google-geocoding-server"
import type { ProfileAddressFieldsFromOrder, ProfileAddressRow } from "@/lib/profile-address"

export type GeocodableAddress = Pick<
  ProfileAddressFieldsFromOrder,
  "line1" | "city" | "postal_code" | "country"
> & {
  line2?: string | null
  state?: string | null
  google_place_id?: string | null
}

export async function verifyGoogleStreetAddress(
  address: GeocodableAddress,
): Promise<GoogleResolvedStreet | null> {
  return googleResolveStreetAddress({
    placeId: address.google_place_id,
    query: addressQuery(address),
  })
}

export function addressFieldsFromVerifiedGoogleStreet(
  resolved: GoogleResolvedStreet,
  geocodedAt = new Date().toISOString(),
): Pick<
  ProfileAddressFieldsFromOrder,
  | "line1"
  | "line2"
  | "city"
  | "state"
  | "postal_code"
  | "country"
  | "google_place_id"
  | "latitude"
  | "longitude"
  | "formatted_address"
  | "google_geocoded_at"
> {
  return {
    line1: resolved.line1,
    line2: resolved.line2 || null,
    city: resolved.city,
    state: resolved.state,
    postal_code: resolved.postalCode,
    country: resolved.country,
    google_place_id: resolved.placeId,
    latitude: resolved.latitude,
    longitude: resolved.longitude,
    formatted_address: resolved.formattedAddress,
    google_geocoded_at: geocodedAt,
  }
}

/** A stored location is trusted only when it was resolved by the server. */
export function verifiedGoogleStreetFromStoredAddress(
  address: Pick<
    ProfileAddressRow,
    | "line1"
    | "line2"
    | "city"
    | "state"
    | "postal_code"
    | "country"
    | "google_place_id"
    | "latitude"
    | "longitude"
    | "formatted_address"
    | "google_geocoded_at"
  >,
): GoogleResolvedStreet | null {
  const placeId = address.google_place_id?.trim() ?? ""
  const formattedAddress = address.formatted_address?.trim() ?? ""
  const geocodedAt = address.google_geocoded_at?.trim() ?? ""
  const latitude = address.latitude
  const longitude = address.longitude
  if (
    !placeId ||
    !formattedAddress ||
    !geocodedAt ||
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude)
  ) {
    return null
  }

  return {
    formattedAddress,
    placeId,
    latitude,
    longitude,
    line1: address.line1,
    line2: address.line2 ?? "",
    city: address.city,
    state: address.state ?? "",
    postalCode: address.postal_code,
    country: address.country,
  }
}

function addressQuery(address: GeocodableAddress): string {
  return [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postal_code,
    address.country || "US",
  ]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(", ")
}
