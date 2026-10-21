export type AdminCohortRetentionCell = {
  offset: number
  users: number
  /** Fraction 0–1 when the month has elapsed; null if still in the future. */
  rate: number | null
  elapsed: boolean
}

export type AdminCohortReturnFrequencyBucket = {
  /** Distinct months with activity after the signup month (M1+). */
  returns: number
  users: number
}

export type AdminCohortRow = {
  cohortMonth: string
  size: number
  retention: AdminCohortRetentionCell[]
  returnFrequency: AdminCohortReturnFrequencyBucket[]
  avgReturnMonths: number
  returnedUsers: number
}

export type AdminCohortsSummary = {
  totalUsers: number
  returnedUsers: number
  /** Fraction 0–1 of cohort users with activity in any month after signup. */
  returnedRate: number | null
  /** Fraction 0–1 retained in month 1 among cohorts that have reached M1. */
  m1RetentionRate: number | null
  avgReturnMonths: number | null
}

export type AdminCohortsDashboard = {
  cohortMonths: number
  horizonMonths: number
  timezone: string
  activityDefinition: string
  summary: AdminCohortsSummary
  cohorts: AdminCohortRow[]
}
