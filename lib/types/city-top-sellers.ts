export type CityTopSeller = {
  id: string
  href: string
  name: string
  locationLabel: string | null
  imageSrc: string
  imageFit: "contain" | "cover"
  salesCount: number
  shopVerified: boolean
}
