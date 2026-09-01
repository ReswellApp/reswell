import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { marketplaceGmvExcludingShippingUsd } from '../seller-fees.ts'

describe('marketplaceGmvExcludingShippingUsd', () => {
  it('subtracts buyer-paid shipping from the order total', () => {
    assert.equal(
      marketplaceGmvExcludingShippingUsd({ amount: 450, shipping_amount: 85 }),
      365,
    )
  })

  it('is the full amount when shipping is missing or zero', () => {
    assert.equal(marketplaceGmvExcludingShippingUsd({ amount: 200 }), 200)
    assert.equal(
      marketplaceGmvExcludingShippingUsd({ amount: 200, shipping_amount: 0 }),
      200,
    )
  })

  it('does not go negative', () => {
    assert.equal(
      marketplaceGmvExcludingShippingUsd({ amount: 40, shipping_amount: 85 }),
      0,
    )
  })
})
