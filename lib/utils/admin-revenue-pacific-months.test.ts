import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildBusinessDayKeysForPeriod,
  businessDayKey,
  businessDayKeyFromMs,
  businessDayStartMs,
} from './business-timezone.ts'

/** 8:08 AM Pacific on 1 Sep 2026. */
const SEP_1_2026_0808_PT = Date.parse('2026-09-01T15:08:00.000Z')
/** True Pacific midnight 1 Sep 2026 (PDT, UTC-7). */
const SEP_1_2026_MIDNIGHT_PT = Date.parse('2026-09-01T07:00:00.000Z')

function septemberPeriodAt(nowMs: number): { periodStartMs: number; periodEndMs: number } {
  const periodStartMs = businessDayStartMs('2026-09-01')
  const monthEndMs = businessDayStartMs('2026-10-01')
  return { periodStartMs, periodEndMs: Math.min(nowMs, monthEndMs) }
}

describe('Pacific month boundaries', () => {
  it('starts 1 Sep 2026 at Pacific midnight, not UTC midnight', () => {
    const start = businessDayStartMs('2026-09-01')
    assert.equal(start, SEP_1_2026_MIDNIGHT_PT)
    assert.equal(businessDayKeyFromMs(start), '2026-09-01')
    assert.equal(businessDayKeyFromMs(start - 1), '2026-08-31')
  })

  it('keeps Aug 31 evening PT sales in August even after UTC has rolled to September', () => {
    assert.equal(businessDayKey('2026-08-31T23:30:00.000Z'), '2026-08-31')
    assert.equal(businessDayKey('2026-09-01T00:30:00.000Z'), '2026-08-31')
    assert.equal(businessDayKey('2026-09-01T06:59:59.999Z'), '2026-08-31')
  })

  it('counts Pacific midnight and later as September', () => {
    assert.equal(businessDayKey('2026-09-01T07:00:00.000Z'), '2026-09-01')
    assert.equal(businessDayKey('2026-09-01T15:08:00.000Z'), '2026-09-01')
  })

  it('does not seed the September daily chart with August 31', () => {
    const period = septemberPeriodAt(SEP_1_2026_0808_PT)
    assert.equal(period.periodStartMs, SEP_1_2026_MIDNIGHT_PT)
    const keys = buildBusinessDayKeysForPeriod(period.periodStartMs, period.periodEndMs)
    assert.deepEqual(keys, ['2026-09-01'])
  })

  it('excludes the next month’s first day from a completed August window', () => {
    const periodStartMs = businessDayStartMs('2026-08-01')
    const periodEndMs = businessDayStartMs('2026-09-01')
    const keys = buildBusinessDayKeysForPeriod(periodStartMs, periodEndMs)
    assert.equal(keys[0], '2026-08-01')
    assert.equal(keys.at(-1), '2026-08-31')
    assert.equal(keys.includes('2026-09-01'), false)
  })

  it('does not put 5:30pm Aug 31 PT orders in the September period', () => {
    const period = septemberPeriodAt(SEP_1_2026_0808_PT)
    const utcSeptemberEvening = Date.parse('2026-09-01T00:30:00.000Z')
    assert.equal(utcSeptemberEvening >= period.periodStartMs, false)
  })
})
