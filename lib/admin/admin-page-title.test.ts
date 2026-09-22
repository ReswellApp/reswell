import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ADMIN_NAV_GROUPS } from '../admin-nav.ts'
import { getAdminPageTitle } from './admin-page-title.ts'

describe('getAdminPageTitle', () => {
  it('returns the exact nav label for a top-level page', () => {
    assert.equal(getAdminPageTitle('/admin/listings', ADMIN_NAV_GROUPS), 'Listings')
    assert.equal(getAdminPageTitle('/admin/hayden-shop', ADMIN_NAV_GROUPS), "Hayden's Shop")
    assert.equal(getAdminPageTitle('/admin/related-content', ADMIN_NAV_GROUPS), 'Related content')
    assert.equal(getAdminPageTitle('/admin/home', ADMIN_NAV_GROUPS), 'Home')
    assert.equal(getAdminPageTitle('/admin/contact-messages', ADMIN_NAV_GROUPS), 'Support tickets')
  })

  it('returns nested support-ticket tool labels', () => {
    assert.equal(getAdminPageTitle('/admin/support-macros', ADMIN_NAV_GROUPS), 'Reply macros')
    assert.equal(
      getAdminPageTitle('/admin/support-reply-examples', ADMIN_NAV_GROUPS),
      'Reply examples',
    )
  })

  it('uses the closest parent for detail routes', () => {
    assert.equal(getAdminPageTitle('/admin/orders/abc-123', ADMIN_NAV_GROUPS), 'Orders')
    assert.equal(getAdminPageTitle('/admin/users/abc-123', ADMIN_NAV_GROUPS), 'Users')
    assert.equal(getAdminPageTitle('/admin/contact-messages/abc-123', ADMIN_NAV_GROUPS), 'Support tickets')
  })

  it('prefers the more specific nav item when both match', () => {
    assert.equal(getAdminPageTitle('/admin/shop/orders', ADMIN_NAV_GROUPS), 'Shop orders')
    assert.equal(getAdminPageTitle('/admin/listings/hidden', ADMIN_NAV_GROUPS), 'Hidden listings')
  })

  it('falls back when the path is unknown', () => {
    assert.equal(getAdminPageTitle('/admin/not-a-real-page', ADMIN_NAV_GROUPS), 'Admin')
  })
})
