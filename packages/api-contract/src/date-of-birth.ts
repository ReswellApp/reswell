import { z } from "zod"

export const MINIMUM_ACCOUNT_AGE = 18

export const DATE_OF_BIRTH_REQUIRED_MESSAGE = "Enter your date of birth."
export const DATE_OF_BIRTH_UNDERAGE_MESSAGE =
  "You must be at least 18 to create a Reswell account."

const ISO_DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

function pad2(value: number): string {
  return String(value).padStart(2, "0")
}

export function formatIsoDateOnly(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

/** Calendar date 18 years before `now`, for date-input max. */
export function latestEligibleBirthDateIso(now = new Date()): string {
  return formatIsoDateOnly(now.getFullYear() - MINIMUM_ACCOUNT_AGE, now.getMonth() + 1, now.getDate())
}

export function parseIsoDateOnly(value: string): { year: number; month: number; day: number } | null {
  const match = ISO_DATE_ONLY.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const utc = new Date(Date.UTC(year, month - 1, day))
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null
  }
  if (year < 1900) return null
  return { year, month, day }
}

export function dateOfBirthMeetsMinimumAge(
  iso: string,
  minAge = MINIMUM_ACCOUNT_AGE,
  now = new Date(),
): boolean {
  const birth = parseIsoDateOnly(iso)
  if (!birth) return false
  const todayY = now.getFullYear()
  const todayM = now.getMonth() + 1
  const todayD = now.getDate()
  let age = todayY - birth.year
  if (todayM < birth.month || (todayM === birth.month && todayD < birth.day)) {
    age -= 1
  }
  return age >= minAge
}

export const signupDateOfBirthSchema = z
  .string()
  .trim()
  .min(1, DATE_OF_BIRTH_REQUIRED_MESSAGE)
  .regex(ISO_DATE_ONLY, DATE_OF_BIRTH_REQUIRED_MESSAGE)
  .refine((value) => dateOfBirthMeetsMinimumAge(value), {
    message: DATE_OF_BIRTH_UNDERAGE_MESSAGE,
  })
