import { cityLandingHref, cityNameSlug } from "@/lib/city-landing-path"

export const SURF_SHOPS_BASE = "/surf-shops"

export type CitySurfShop = {
  id: string
  slug: string
  name: string
  city: string
  state: string
  /** Public city landing slugs this shop should appear on (`santa-barbara`, `carpinteria`, …). */
  citySlugs: string[]
  /** City landing featured as “used boards nearby”. */
  nearbyCitySlug?: string
  nearbyCityName?: string
  logoSrc: string
  address?: string
  phone?: string
  mapsUrl?: string
  websiteUrl?: string
  foundedYear?: number
  description?: string
}

/**
 * Local surf shops for city landings and `/surf-shops/[slug]`. Hardcoded on purpose —
 * add entries here when asked; nothing is stored in the database.
 */
export const CITY_SURF_SHOPS: CitySurfShop[] = [
  {
    id: "rincon-designs",
    slug: "rincon-designs",
    name: "Rincon Designs Surf Shop",
    city: "Carpinteria",
    state: "CA",
    citySlugs: ["santa-barbara", "carpinteria"],
    nearbyCitySlug: "santa-barbara",
    nearbyCityName: "Santa Barbara",
    logoSrc: "/images/cities/surf-shops/rincon-designs.jpg",
    address: "659 Linden Ave, Carpinteria, CA 93013",
    phone: "(805) 684-2413",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Rincon+Designs+Surf+Shop+659+Linden+Ave+Carpinteria+CA",
    foundedYear: 1980,
    description:
      "Independent surf shop in Carpinteria, a few minutes from Rincon. Matt Moore surfboards, est. 1980.",
  },
  {
    id: "beach-house-santa-barbara",
    slug: "beach-house-santa-barbara",
    name: "Beach House Santa Barbara",
    city: "Santa Barbara",
    state: "CA",
    citySlugs: ["santa-barbara"],
    nearbyCitySlug: "santa-barbara",
    nearbyCityName: "Santa Barbara",
    logoSrc: "/images/cities/surf-shops/beach-house-santa-barbara.jpg",
    address: "10 State St, Santa Barbara, CA 93101",
    phone: "(805) 963-1281",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Beach+House+Surf+Shop+10+State+St+Santa+Barbara+CA",
    websiteUrl: "https://surfnwearbeachhouse.com",
    foundedYear: 1962,
    description:
      "Independent surf shop at the bottom of State Street, steps from the water. Surf N' Wear's Beach House, serving Santa Barbara since 1962.",
  },
  {
    id: "surf-country-goleta",
    slug: "surf-country-goleta",
    name: "Surf Country",
    city: "Goleta",
    state: "CA",
    citySlugs: ["goleta"],
    nearbyCitySlug: "goleta",
    nearbyCityName: "Goleta",
    logoSrc: "/images/cities/surf-shops/surf-country-goleta.jpg",
    address: "109B South Fairview Avenue, Goleta, CA 93117",
    phone: "(805) 683-4450",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Surf+Country+109+South+Fairview+Avenue+Goleta+CA",
    websiteUrl: "https://www.surfcountrygoleta.com",
    foundedYear: 1999,
    description:
      "Independent surf and skate shop on Fairview Avenue in Goleta. Boards, ding repair, rentals, and lessons since 1999.",
  },
  {
    id: "ventura-surf-shop",
    slug: "ventura-surf-shop",
    name: "Ventura Surf Shop",
    city: "Ventura",
    state: "CA",
    citySlugs: ["ventura", "oxnard"],
    nearbyCitySlug: "ventura",
    nearbyCityName: "Ventura",
    logoSrc: "/images/cities/surf-shops/ventura-surf-shop.png",
    address: "88 E Thompson Blvd, Ventura, CA 93001",
    phone: "(805) 643-1062",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Ventura+Surf+Shop+88+E+Thompson+Blvd+Ventura+CA",
    websiteUrl: "https://shopvss.com",
    foundedYear: 1962,
    description:
      "Independent surf shop on Thompson Boulevard. Custom and used boards, wetsuits, and gear in downtown Ventura since 1962.",
  },
  {
    id: "drill-surf-skate",
    slug: "drill-surf-skate",
    name: "Drill Surf & Skate",
    city: "Malibu",
    state: "CA",
    citySlugs: ["malibu"],
    nearbyCitySlug: "malibu",
    nearbyCityName: "Malibu",
    logoSrc: "/images/cities/surf-shops/drill-surf-skate.png",
    address: "30745 Pacific Coast Hwy #D20, Malibu, CA 90265",
    phone: "(310) 457-7715",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Drill+Surf+Skate+30745+Pacific+Coast+Hwy+Malibu+CA",
    websiteUrl: "https://drillsurfskate.com",
    foundedYear: 1991,
    description:
      "Independent surf and skate shop on PCH in Malibu. Boards, wetsuits, and hardgoods, est. 1991.",
  },
  {
    id: "rider-shack",
    slug: "rider-shack",
    name: "Rider Shack",
    city: "Los Angeles",
    state: "CA",
    citySlugs: ["los-angeles"],
    nearbyCitySlug: "los-angeles",
    nearbyCityName: "Los Angeles",
    logoSrc: "/images/cities/surf-shops/rider-shack.png",
    address: "13211 W Washington Blvd, Los Angeles, CA 90066",
    phone: "(310) 821-7873",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Rider+Shack+13211+W+Washington+Blvd+Los+Angeles+CA",
    websiteUrl: "https://www.ridershack.com",
    foundedYear: 2006,
    description:
      "Independent surf shop in Mar Vista. New and used boards, rentals, and gear near Venice and the westside.",
  },
  {
    id: "surf-ride",
    slug: "surf-ride",
    name: "Surf Ride",
    city: "Oceanside",
    state: "CA",
    citySlugs: ["oceanside"],
    nearbyCitySlug: "oceanside",
    nearbyCityName: "Oceanside",
    logoSrc: "/images/cities/surf-shops/surf-ride.png",
    address: "1909 South Coast Hwy, Oceanside, CA 92054",
    phone: "(760) 433-4020",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Surf+Ride+1909+South+Coast+Hwy+Oceanside+CA",
    websiteUrl: "https://www.surfride.com",
    foundedYear: 1974,
    description:
      "Independent surf shop on Coast Highway in Oceanside. Boards, wetsuits, and hardgoods since 1974.",
  },
  {
    id: "used-surf",
    slug: "used-surf",
    name: "UsedSurf",
    city: "San Clemente",
    state: "CA",
    citySlugs: ["san-clemente"],
    nearbyCitySlug: "san-clemente",
    nearbyCityName: "San Clemente",
    logoSrc: "/images/cities/surf-shops/used-surf.png",
    address: "216 Calle de Los Molinos, San Clemente, CA 92672",
    phone: "(949) 310-6602",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=UsedSurf+216+Calle+de+Los+Molinos+San+Clemente+CA",
    websiteUrl: "https://usedsurf.com",
    description:
      "Independent used-board shop in San Clemente. Buy, sell, and trade surfboards near Trestles.",
  },
  {
    id: "hansen-surfboards",
    slug: "hansen-surfboards",
    name: "Hansen Surfboards",
    city: "Encinitas",
    state: "CA",
    citySlugs: ["encinitas", "del-mar"],
    nearbyCitySlug: "encinitas",
    nearbyCityName: "Encinitas",
    logoSrc: "/images/cities/surf-shops/hansen-surf.jpg",
    address: "1105 S Coast Hwy 101, Encinitas, CA 92024",
    phone: "(760) 753-6595",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Hansen+Surfboards+1105+S+Coast+Hwy+101+Encinitas+CA",
    websiteUrl: "https://www.hansensurf.com",
    foundedYear: 1961,
    description:
      "Independent surf shop on Highway 101 in Encinitas. Hansen Surfboards, serving North County San Diego since 1961.",
  },
  {
    id: "south-coast-surf-shop",
    slug: "south-coast-surf-shop",
    name: "South Coast Surf Shop",
    city: "San Diego",
    state: "CA",
    citySlugs: ["san-diego", "ocean-beach"],
    nearbyCitySlug: "san-diego",
    nearbyCityName: "San Diego",
    logoSrc: "/images/cities/surf-shops/south-coast-surf-shop.png",
    address: "5023 Newport Avenue, San Diego, CA 92107",
    phone: "(619) 223-7017",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=South+Coast+Surf+Shop+5023+Newport+Avenue+San+Diego+CA",
    websiteUrl: "https://southcoast.com",
    foundedYear: 1974,
    description:
      "Independent surf shop on Newport Avenue in Ocean Beach. South Coast Surf Shop, est. 1974.",
  },
  {
    id: "mitchs-surf-shop",
    slug: "mitchs-surf-shop",
    name: "Mitch's Surf Shop",
    city: "La Jolla",
    state: "CA",
    citySlugs: ["san-diego", "la-jolla"],
    nearbyCitySlug: "san-diego",
    nearbyCityName: "San Diego",
    logoSrc: "/images/cities/surf-shops/mitchs-surf-shop.png",
    address: "631 Pearl Street, La Jolla, CA 92037",
    phone: "(858) 459-5933",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Mitchs+Surf+Shop+631+Pearl+Street+La+Jolla+CA",
    websiteUrl: "https://mitchssurfshop.com",
    foundedYear: 1967,
    description:
      "Independent surf shop in La Jolla. Boards, wetsuits, and hardgoods since 1967.",
  },
  {
    id: "freeline-surf-shop",
    slug: "freeline-surf-shop",
    name: "Freeline Surf Shop",
    city: "Santa Cruz",
    state: "CA",
    citySlugs: ["santa-cruz"],
    nearbyCitySlug: "santa-cruz",
    nearbyCityName: "Santa Cruz",
    logoSrc: "/images/cities/surf-shops/freeline-surf.png",
    address: "821 41st Ave, Santa Cruz, CA 95062",
    phone: "(831) 476-2950",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Freeline+Surf+Shop+821+41st+Ave+Santa+Cruz+CA",
    websiteUrl: "https://www.freelinesurf.com",
    foundedYear: 1969,
    description:
      "Independent surf shop on 41st Avenue in Santa Cruz. Freeline, serving the east side since 1969.",
  },
  {
    id: "mollusk-surf-shop",
    slug: "mollusk-surf-shop",
    name: "Mollusk Surf Shop",
    city: "San Francisco",
    state: "CA",
    citySlugs: ["san-francisco"],
    nearbyCitySlug: "san-francisco",
    nearbyCityName: "San Francisco",
    logoSrc: "/images/cities/surf-shops/mollusk.png",
    address: "4500 Irving Street, San Francisco, CA 94122",
    phone: "(415) 564-6300",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Mollusk+Surf+Shop+4500+Irving+Street+San+Francisco+CA",
    websiteUrl: "https://mollusksurfshop.com",
    foundedYear: 2005,
    description:
      "Independent surf shop in the Outer Sunset, a few blocks from Ocean Beach. Mollusk Surf Shop, est. 2005.",
  },
  {
    id: "wavelengths",
    slug: "wavelengths",
    name: "Wavelengths Surf Shop",
    city: "Morro Bay",
    state: "CA",
    citySlugs: ["morro-bay", "los-osos", "san-luis-obispo"],
    nearbyCitySlug: "morro-bay",
    nearbyCityName: "Morro Bay",
    logoSrc: "/images/cities/surf-shops/wavelengths.png",
    address: "998 Embarcadero, Morro Bay, CA 93442",
    phone: "(805) 772-3904",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Wavelengths+Surf+Shop+998+Embarcadero+Morro+Bay+CA",
    websiteUrl: "https://www.wavelengthssbi.com",
    description:
      "Independent surf shop on the Embarcadero in Morro Bay, across from Morro Rock.",
  },
  {
    id: "urban-surf",
    slug: "urban-surf",
    name: "Urban Surf",
    city: "Seattle",
    state: "WA",
    citySlugs: ["seattle"],
    nearbyCitySlug: "seattle",
    nearbyCityName: "Seattle",
    logoSrc: "/images/cities/surf-shops/urban-surf.jpg",
    address: "2100 N Northlake Way, Seattle, WA 98103",
    phone: "(206) 545-9463",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Urban+Surf+2100+N+Northlake+Way+Seattle+WA",
    websiteUrl: "https://urbansurf.com",
    foundedYear: 1985,
    description:
      "Independent surf and skate shop on Northlake Way in Seattle. Boards, wetsuits, and gear since 1985.",
  },
  {
    id: "mckevlins",
    slug: "mckevlins",
    name: "McKevlin's Surf Shop",
    city: "Folly Beach",
    state: "SC",
    citySlugs: ["charleston", "folly-beach"],
    nearbyCitySlug: "charleston",
    nearbyCityName: "Charleston",
    logoSrc: "/images/cities/surf-shops/mckevlins.png",
    address: "8 Center Street, Folly Beach, SC 29439",
    phone: "(843) 588-2247",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=McKevlins+Surf+Shop+8+Center+Street+Folly+Beach+SC",
    websiteUrl: "https://mckevlins.com",
    foundedYear: 1965,
    description:
      "Independent surf shop on Center Street in Folly Beach. McKevlin's, serving the Charleston coast since 1965.",
  },
  {
    id: "hic-kailua",
    slug: "hic-kailua",
    name: "Hawaiian Island Creations",
    city: "Kailua",
    state: "HI",
    citySlugs: ["kailua"],
    nearbyCitySlug: "kailua",
    nearbyCityName: "Kailua",
    logoSrc: "/images/cities/surf-shops/hic-kailua.jpg",
    address: "354 Hahani St, Kailua, HI 96734",
    phone: "(808) 266-6730",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=HIC+Surf+354+Hahani+St+Kailua+HI",
    websiteUrl: "https://hicsurf.com",
    foundedYear: 1971,
    description:
      "HIC's Kailua shop on Hahani Street. Boards, wetsuits, and Hawaiian Island Creations hardgoods, est. 1971.",
  },
  {
    id: "glide-surf-co",
    slug: "glide-surf-co",
    name: "Glide Surf Co.",
    city: "Asbury Park",
    state: "NJ",
    citySlugs: ["asbury-park"],
    nearbyCitySlug: "asbury-park",
    nearbyCityName: "Asbury Park",
    logoSrc: "/images/cities/surf-shops/glide-surf-co.png",
    address: "520 Bangs Avenue, Asbury Park, NJ 07712",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Glide+Surf+Co+520+Bangs+Avenue+Asbury+Park+NJ",
    websiteUrl: "https://www.glidesurfco.com",
    description:
      "Independent surf shop on Bangs Avenue in Asbury Park. Custom boards and hardgoods on the Jersey Shore.",
  },
]

export function surfShopHref(slug: string): string {
  return `${SURF_SHOPS_BASE}/${slug}`
}

export function surfShopLocationLabel(shop: CitySurfShop): string {
  return `${shop.city}, ${shop.state}`
}

export function surfShopTelHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "")
  return `tel:${digits}`
}

export function findSurfShopBySlug(slug: string): CitySurfShop | null {
  const key = slug.trim().toLowerCase()
  if (!key) return null
  return CITY_SURF_SHOPS.find((shop) => shop.slug === key || shop.id === key) ?? null
}

export function surfShopNearbyBoardsHref(shop: CitySurfShop): string | null {
  if (!shop.nearbyCitySlug) return null
  return cityLandingHref(shop.nearbyCitySlug)
}

export function surfShopsForCity(city: { slug: string; city: string }): CitySurfShop[] {
  const slugs = new Set([city.slug.toLowerCase(), cityNameSlug(city.city)])
  return CITY_SURF_SHOPS.filter(
    (shop) =>
      shop.citySlugs.some((slug) => slugs.has(slug)) ||
      shop.city.toLowerCase() === city.city.toLowerCase(),
  )
}
