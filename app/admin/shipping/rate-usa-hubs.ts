/**
 * USA shipping hubs for the admin rate matrix.
 * Real street addresses so ShipEngine can rate reliably; organized by region
 * for coastal surf origins and major buyer destinations.
 */

import type { AddressFields } from './address-fields'

export type UsaHubRegion =
  | 'socal'
  | 'norcal'
  | 'pnw'
  | 'hawaii'
  | 'southwest'
  | 'rockies'
  | 'texas'
  | 'midwest'
  | 'southeast'
  | 'florida'
  | 'mid_atlantic'
  | 'northeast'

export type UsaShippingHub = {
  id: string
  label: string
  region: UsaHubRegion
  /** Short city, ST for matrix headers */
  shortLabel: string
  /** Typical seller origin / buyer destination role hint */
  roles: Array<'origin' | 'destination'>
  address: AddressFields
}

export const USA_HUB_REGION_LABELS: Record<UsaHubRegion, string> = {
  socal: 'Southern California',
  norcal: 'Northern California',
  pnw: 'Pacific Northwest',
  hawaii: 'Hawaii',
  southwest: 'Southwest',
  rockies: 'Rockies',
  texas: 'Texas',
  midwest: 'Midwest',
  southeast: 'Southeast',
  florida: 'Florida',
  mid_atlantic: 'Mid-Atlantic',
  northeast: 'Northeast',
}

export const USA_HUB_REGION_ORDER: UsaHubRegion[] = [
  'socal',
  'norcal',
  'pnw',
  'hawaii',
  'southwest',
  'rockies',
  'texas',
  'midwest',
  'southeast',
  'florida',
  'mid_atlantic',
  'northeast',
]

type HubAddressInput = {
  name: string
  address_line1: string
  city_locality: string
  state_province: string
  postal_code: string
  phone?: string
  company_name?: string
  address_line2?: string
  residential?: AddressFields['residential']
}

function hub(
  partial: Omit<UsaShippingHub, 'address'> & { address: HubAddressInput },
): UsaShippingHub {
  return {
    id: partial.id,
    label: partial.label,
    region: partial.region,
    shortLabel: partial.shortLabel,
    roles: partial.roles,
    address: {
      name: partial.address.name,
      phone: partial.address.phone ?? '555-0100',
      company_name: partial.address.company_name ?? '',
      address_line1: partial.address.address_line1,
      address_line2: partial.address.address_line2 ?? '',
      city_locality: partial.address.city_locality,
      state_province: partial.address.state_province,
      postal_code: partial.address.postal_code,
      country_code: 'US',
      residential: partial.address.residential ?? 'no',
    },
  }
}

export const USA_SHIPPING_HUBS: UsaShippingHub[] = [
  // —— SoCal (primary surf origins) ——
  hub({
    id: 'oceanside-ca',
    label: 'Oceanside, CA',
    shortLabel: 'Oceanside, CA',
    region: 'socal',
    roles: ['origin', 'destination'],
    address: {
      name: 'Oceanside shipper',
      address_line1: '300 N Coast Hwy',
      city_locality: 'Oceanside',
      state_province: 'CA',
      postal_code: '92054',
    },
  }),
  hub({
    id: 'san-clemente-ca',
    label: 'San Clemente, CA',
    shortLabel: 'San Clemente, CA',
    region: 'socal',
    roles: ['origin', 'destination'],
    address: {
      name: 'San Clemente shipper',
      address_line1: '101 N El Camino Real',
      city_locality: 'San Clemente',
      state_province: 'CA',
      postal_code: '92672',
    },
  }),
  hub({
    id: 'huntington-beach-ca',
    label: 'Huntington Beach, CA',
    shortLabel: 'HB, CA',
    region: 'socal',
    roles: ['origin', 'destination'],
    address: {
      name: 'Huntington Beach shipper',
      address_line1: '200 Main St',
      city_locality: 'Huntington Beach',
      state_province: 'CA',
      postal_code: '92648',
    },
  }),
  hub({
    id: 'san-diego-ca',
    label: 'San Diego, CA',
    shortLabel: 'San Diego, CA',
    region: 'socal',
    roles: ['origin', 'destination'],
    address: {
      name: 'San Diego shipper',
      address_line1: '750 A St',
      city_locality: 'San Diego',
      state_province: 'CA',
      postal_code: '92101',
    },
  }),
  hub({
    id: 'encinitas-ca',
    label: 'Encinitas, CA',
    shortLabel: 'Encinitas, CA',
    region: 'socal',
    roles: ['origin', 'destination'],
    address: {
      name: 'Encinitas shipper',
      address_line1: '450 S Coast Hwy 101',
      city_locality: 'Encinitas',
      state_province: 'CA',
      postal_code: '92024',
      residential: 'yes',
    },
  }),
  hub({
    id: 'santa-barbara-ca',
    label: 'Santa Barbara, CA',
    shortLabel: 'Santa Barbara, CA',
    region: 'socal',
    roles: ['origin', 'destination'],
    address: {
      name: 'Santa Barbara shipper',
      address_line1: '500 State St',
      city_locality: 'Santa Barbara',
      state_province: 'CA',
      postal_code: '93101',
    },
  }),
  hub({
    id: 'ventura-ca',
    label: 'Ventura, CA',
    shortLabel: 'Ventura, CA',
    region: 'socal',
    roles: ['origin', 'destination'],
    address: {
      name: 'Ventura shipper',
      address_line1: '255 S Seaward Ave',
      city_locality: 'Ventura',
      state_province: 'CA',
      postal_code: '93001',
    },
  }),
  hub({
    id: 'los-angeles-ca',
    label: 'Los Angeles, CA',
    shortLabel: 'LA, CA',
    region: 'socal',
    roles: ['origin', 'destination'],
    address: {
      name: 'LA fulfillment',
      address_line1: '1200 Getty Center Dr',
      city_locality: 'Los Angeles',
      state_province: 'CA',
      postal_code: '90049',
    },
  }),

  // —— NorCal ——
  hub({
    id: 'san-francisco-ca',
    label: 'San Francisco, CA',
    shortLabel: 'SF, CA',
    region: 'norcal',
    roles: ['origin', 'destination'],
    address: {
      name: 'SF shipper',
      address_line1: '1 Market St',
      city_locality: 'San Francisco',
      state_province: 'CA',
      postal_code: '94105',
    },
  }),
  hub({
    id: 'santa-cruz-ca',
    label: 'Santa Cruz, CA',
    shortLabel: 'Santa Cruz, CA',
    region: 'norcal',
    roles: ['origin', 'destination'],
    address: {
      name: 'Santa Cruz shipper',
      address_line1: '1200 Pacific Ave',
      city_locality: 'Santa Cruz',
      state_province: 'CA',
      postal_code: '95060',
    },
  }),
  hub({
    id: 'half-moon-bay-ca',
    label: 'Half Moon Bay, CA',
    shortLabel: 'HMB, CA',
    region: 'norcal',
    roles: ['origin', 'destination'],
    address: {
      name: 'Half Moon Bay shipper',
      address_line1: '520 Kelly Ave',
      city_locality: 'Half Moon Bay',
      state_province: 'CA',
      postal_code: '94019',
      residential: 'yes',
    },
  }),

  // —— PNW ——
  hub({
    id: 'seattle-wa',
    label: 'Seattle, WA',
    shortLabel: 'Seattle, WA',
    region: 'pnw',
    roles: ['origin', 'destination'],
    address: {
      name: 'Seattle shipper',
      address_line1: '400 Broad St',
      city_locality: 'Seattle',
      state_province: 'WA',
      postal_code: '98109',
    },
  }),
  hub({
    id: 'portland-or',
    label: 'Portland, OR',
    shortLabel: 'Portland, OR',
    region: 'pnw',
    roles: ['origin', 'destination'],
    address: {
      name: 'Portland shipper',
      address_line1: '1120 SW 5th Ave',
      city_locality: 'Portland',
      state_province: 'OR',
      postal_code: '97204',
    },
  }),

  // —— Hawaii ——
  hub({
    id: 'honolulu-hi',
    label: 'Honolulu, HI',
    shortLabel: 'Honolulu, HI',
    region: 'hawaii',
    roles: ['origin', 'destination'],
    address: {
      name: 'Honolulu recipient',
      address_line1: '2335 Kalakaua Ave',
      city_locality: 'Honolulu',
      state_province: 'HI',
      postal_code: '96815',
    },
  }),

  // —— Southwest ——
  hub({
    id: 'phoenix-az',
    label: 'Phoenix, AZ',
    shortLabel: 'Phoenix, AZ',
    region: 'southwest',
    roles: ['origin', 'destination'],
    address: {
      name: 'Phoenix shipper',
      address_line1: '201 E Washington St',
      city_locality: 'Phoenix',
      state_province: 'AZ',
      postal_code: '85004',
    },
  }),
  hub({
    id: 'las-vegas-nv',
    label: 'Las Vegas, NV',
    shortLabel: 'Las Vegas, NV',
    region: 'southwest',
    roles: ['origin', 'destination'],
    address: {
      name: 'Las Vegas shipper',
      address_line1: '3355 Las Vegas Blvd S',
      city_locality: 'Las Vegas',
      state_province: 'NV',
      postal_code: '89109',
    },
  }),

  // —— Rockies ——
  hub({
    id: 'denver-co',
    label: 'Denver, CO',
    shortLabel: 'Denver, CO',
    region: 'rockies',
    roles: ['origin', 'destination'],
    address: {
      name: 'Denver shipper',
      address_line1: '1701 Wynkoop St',
      city_locality: 'Denver',
      state_province: 'CO',
      postal_code: '80202',
    },
  }),

  // —— Texas ——
  hub({
    id: 'houston-tx',
    label: 'Houston, TX',
    shortLabel: 'Houston, TX',
    region: 'texas',
    roles: ['origin', 'destination'],
    address: {
      name: 'Houston shipper',
      address_line1: '1600 Smith St',
      city_locality: 'Houston',
      state_province: 'TX',
      postal_code: '77002',
    },
  }),
  hub({
    id: 'austin-tx',
    label: 'Austin, TX',
    shortLabel: 'Austin, TX',
    region: 'texas',
    roles: ['origin', 'destination'],
    address: {
      name: 'Austin shipper',
      address_line1: '4301 Bull Creek Road',
      city_locality: 'Austin',
      state_province: 'TX',
      postal_code: '78731',
    },
  }),

  // —— Midwest ——
  hub({
    id: 'chicago-il',
    label: 'Chicago, IL',
    shortLabel: 'Chicago, IL',
    region: 'midwest',
    roles: ['origin', 'destination'],
    address: {
      name: 'Chicago recipient',
      address_line1: '233 S Wacker Dr',
      city_locality: 'Chicago',
      state_province: 'IL',
      postal_code: '60606',
    },
  }),
  hub({
    id: 'minneapolis-mn',
    label: 'Minneapolis, MN',
    shortLabel: 'Minneapolis, MN',
    region: 'midwest',
    roles: ['origin', 'destination'],
    address: {
      name: 'Minneapolis recipient',
      address_line1: '88 S 10th St',
      city_locality: 'Minneapolis',
      state_province: 'MN',
      postal_code: '55403',
    },
  }),

  // —— Southeast ——
  hub({
    id: 'atlanta-ga',
    label: 'Atlanta, GA',
    shortLabel: 'Atlanta, GA',
    region: 'southeast',
    roles: ['origin', 'destination'],
    address: {
      name: 'Atlanta recipient',
      address_line1: '1 Atlantic Station',
      city_locality: 'Atlanta',
      state_province: 'GA',
      postal_code: '30363',
    },
  }),
  hub({
    id: 'charleston-sc',
    label: 'Charleston, SC',
    shortLabel: 'Charleston, SC',
    region: 'southeast',
    roles: ['origin', 'destination'],
    address: {
      name: 'Charleston recipient',
      address_line1: '40 N Market St',
      city_locality: 'Charleston',
      state_province: 'SC',
      postal_code: '29401',
      residential: 'yes',
    },
  }),

  // —— Florida ——
  hub({
    id: 'miami-fl',
    label: 'Miami, FL',
    shortLabel: 'Miami, FL',
    region: 'florida',
    roles: ['origin', 'destination'],
    address: {
      name: 'Miami recipient',
      address_line1: '100 S Biscayne Blvd',
      city_locality: 'Miami',
      state_province: 'FL',
      postal_code: '33131',
    },
  }),
  hub({
    id: 'jacksonville-fl',
    label: 'Jacksonville, FL',
    shortLabel: 'Jacksonville, FL',
    region: 'florida',
    roles: ['origin', 'destination'],
    address: {
      name: 'Jacksonville recipient',
      address_line1: '1 Independent Dr',
      city_locality: 'Jacksonville',
      state_province: 'FL',
      postal_code: '32202',
    },
  }),

  // —— Mid-Atlantic ——
  hub({
    id: 'washington-dc',
    label: 'Washington, DC',
    shortLabel: 'Washington, DC',
    region: 'mid_atlantic',
    roles: ['origin', 'destination'],
    address: {
      name: 'DC recipient',
      address_line1: '1600 Pennsylvania Avenue NW',
      city_locality: 'Washington',
      state_province: 'DC',
      postal_code: '20500',
    },
  }),
  hub({
    id: 'virginia-beach-va',
    label: 'Virginia Beach, VA',
    shortLabel: 'Virginia Beach, VA',
    region: 'mid_atlantic',
    roles: ['origin', 'destination'],
    address: {
      name: 'Virginia Beach recipient',
      address_line1: '2101 Parks Ave',
      city_locality: 'Virginia Beach',
      state_province: 'VA',
      postal_code: '23451',
      residential: 'yes',
    },
  }),

  // —— Northeast ——
  hub({
    id: 'brooklyn-ny',
    label: 'Brooklyn, NY',
    shortLabel: 'Brooklyn, NY',
    region: 'northeast',
    roles: ['origin', 'destination'],
    address: {
      name: 'Brooklyn shipper',
      address_line1: '1 Pierrepont St',
      city_locality: 'Brooklyn',
      state_province: 'NY',
      postal_code: '11201',
      residential: 'yes',
    },
  }),
  hub({
    id: 'boston-ma',
    label: 'Boston, MA',
    shortLabel: 'Boston, MA',
    region: 'northeast',
    roles: ['origin', 'destination'],
    address: {
      name: 'Boston recipient',
      address_line1: '100 Federal St',
      address_line2: 'Suite 400',
      city_locality: 'Boston',
      state_province: 'MA',
      postal_code: '02110',
    },
  }),
  hub({
    id: 'new-york-ny',
    label: 'New York, NY',
    shortLabel: 'NYC, NY',
    region: 'northeast',
    roles: ['origin', 'destination'],
    address: {
      name: 'NYC shipper',
      address_line1: '450 W 33rd St',
      city_locality: 'New York',
      state_province: 'NY',
      postal_code: '10001',
    },
  }),
]

export function getUsaShippingHub(id: string): UsaShippingHub | undefined {
  return USA_SHIPPING_HUBS.find((h) => h.id === id)
}

/** Sensible defaults for a first research pass (coastal origins → national destinations). */
export const DEFAULT_MATRIX_ORIGIN_IDS = [
  'oceanside-ca',
  'santa-cruz-ca',
  'houston-tx',
  'brooklyn-ny',
] as const

export const DEFAULT_MATRIX_DESTINATION_IDS = [
  'boston-ma',
  'miami-fl',
  'chicago-il',
  'honolulu-hi',
  'san-diego-ca',
  'denver-co',
] as const

/** Soft cap before we show a strong warning (ShipEngine rate API, sequential). */
export const MATRIX_QUOTE_SOFT_WARN = 48
export const MATRIX_QUOTE_HARD_WARN = 120
