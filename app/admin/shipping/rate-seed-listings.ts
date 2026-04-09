import type { AddressFields } from './address-fields'

export type RateSeedListing = {
  id: string
  /** Short label for buttons */
  label: string
  /** One-line description of the corridor */
  description: string
  shipFrom: AddressFields
  shipTo: AddressFields
}

const baseResidential = 'no' as const

/**
 * Preset ship-from / ship-to pairs for the admin rate calculator (demo and QA).
 */
export const RATE_SEED_LISTINGS: RateSeedListing[] = [
  {
    id: 'socal-east',
    label: 'SoCal → East Coast',
    description: 'Oceanside, CA → Boston, MA',
    shipFrom: {
      name: 'SoCal warehouse',
      phone: '555-0101',
      company_name: '',
      address_line1: '300 N Coast Hwy',
      address_line2: '',
      city_locality: 'Oceanside',
      state_province: 'CA',
      postal_code: '92054',
      country_code: 'US',
      residential: baseResidential,
    },
    shipTo: {
      name: 'East Coast recipient',
      phone: '555-0201',
      company_name: '',
      address_line1: '100 Federal St',
      address_line2: 'Suite 400',
      city_locality: 'Boston',
      state_province: 'MA',
      postal_code: '02110',
      country_code: 'US',
      residential: baseResidential,
    },
  },
  {
    id: 'norcal-texas',
    label: 'NorCal → Texas',
    description: 'San Francisco, CA → Houston, TX',
    shipFrom: {
      name: 'Bay Area shipper',
      phone: '555-0102',
      company_name: '',
      address_line1: '1 Ferry Building',
      address_line2: '',
      city_locality: 'San Francisco',
      state_province: 'CA',
      postal_code: '94111',
      country_code: 'US',
      residential: baseResidential,
    },
    shipTo: {
      name: 'Texas recipient',
      phone: '555-0202',
      company_name: '',
      address_line1: '1600 Smith St',
      address_line2: '',
      city_locality: 'Houston',
      state_province: 'TX',
      postal_code: '77002',
      country_code: 'US',
      residential: baseResidential,
    },
  },
  {
    id: 'socal-oahu',
    label: 'SoCal → Oʻahu',
    description: 'Los Angeles, CA → Honolulu, HI',
    shipFrom: {
      name: 'LA fulfillment',
      phone: '555-0103',
      company_name: '',
      address_line1: '1200 Getty Center Dr',
      address_line2: '',
      city_locality: 'Los Angeles',
      state_province: 'CA',
      postal_code: '90049',
      country_code: 'US',
      residential: baseResidential,
    },
    shipTo: {
      name: 'Honolulu recipient',
      phone: '555-0203',
      company_name: '',
      address_line1: '2335 Kalakaua Ave',
      address_line2: '',
      city_locality: 'Honolulu',
      state_province: 'HI',
      postal_code: '96815',
      country_code: 'US',
      residential: baseResidential,
    },
  },
]
