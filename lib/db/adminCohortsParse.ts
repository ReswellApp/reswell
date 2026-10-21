import type {
  AdminCohortReturnFrequencyBucket,
  AdminCohortRetentionCell,
  AdminCohortRow,
  AdminCohortsDashboard,
  AdminCohortsSummary,
} from "@/lib/types/adminCohorts"

function asInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === "string" && value.trim()) {
    const n = Number(value)
    if (Number.isFinite(n)) return Math.trunc(n)
  }
  return null
}

function asFloat(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function asBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value
  return null
}

export function parseAdminCohortsDashboard(raw: unknown): AdminCohortsDashboard | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>

  const cohortMonths = asInt(o.cohortMonths)
  const horizonMonths = asInt(o.horizonMonths)
  const timezone = asString(o.timezone)
  const activityDefinition = asString(o.activityDefinition)
  if (
    cohortMonths == null ||
    horizonMonths == null ||
    !timezone ||
    !activityDefinition
  ) {
    return null
  }

  const summary = parseSummary(o.summary)
  const cohorts = parseCohorts(o.cohorts)
  if (!summary || !cohorts) return null

  return {
    cohortMonths,
    horizonMonths,
    timezone,
    activityDefinition,
    summary,
    cohorts,
  }
}

function parseSummary(raw: unknown): AdminCohortsSummary | null {
  if (!raw || typeof raw !== "object") return null
  const s = raw as Record<string, unknown>
  const totalUsers = asInt(s.totalUsers)
  const returnedUsers = asInt(s.returnedUsers)
  if (totalUsers == null || returnedUsers == null) return null

  const returnedRate = s.returnedRate == null ? null : asFloat(s.returnedRate)
  const m1RetentionRate = s.m1RetentionRate == null ? null : asFloat(s.m1RetentionRate)
  const avgReturnMonths = s.avgReturnMonths == null ? null : asFloat(s.avgReturnMonths)
  if (s.returnedRate != null && returnedRate == null) return null
  if (s.m1RetentionRate != null && m1RetentionRate == null) return null
  if (s.avgReturnMonths != null && avgReturnMonths == null) return null

  return {
    totalUsers,
    returnedUsers,
    returnedRate,
    m1RetentionRate,
    avgReturnMonths,
  }
}

function parseCohorts(raw: unknown): AdminCohortRow[] | null {
  if (!Array.isArray(raw)) return null
  const rows: AdminCohortRow[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") return null
    const r = item as Record<string, unknown>
    const cohortMonth = asString(r.cohortMonth)
    const size = asInt(r.size)
    const avgReturnMonths = asFloat(r.avgReturnMonths)
    const returnedUsers = asInt(r.returnedUsers)
    const retention = parseRetention(r.retention)
    const returnFrequency = parseReturnFrequency(r.returnFrequency)
    if (
      !cohortMonth ||
      size == null ||
      avgReturnMonths == null ||
      returnedUsers == null ||
      !retention ||
      !returnFrequency
    ) {
      return null
    }
    rows.push({
      cohortMonth,
      size,
      retention,
      returnFrequency,
      avgReturnMonths,
      returnedUsers,
    })
  }
  return rows
}

function parseRetention(raw: unknown): AdminCohortRetentionCell[] | null {
  if (!Array.isArray(raw)) return null
  const cells: AdminCohortRetentionCell[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") return null
    const r = item as Record<string, unknown>
    const offset = asInt(r.offset)
    const users = asInt(r.users)
    const elapsed = asBool(r.elapsed)
    if (offset == null || users == null || elapsed == null) return null
    const rate = r.rate == null ? null : asFloat(r.rate)
    if (r.rate != null && rate == null) return null
    cells.push({ offset, users, rate, elapsed })
  }
  return cells
}

function parseReturnFrequency(raw: unknown): AdminCohortReturnFrequencyBucket[] | null {
  if (!Array.isArray(raw)) return null
  const buckets: AdminCohortReturnFrequencyBucket[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") return null
    const r = item as Record<string, unknown>
    const returns = asInt(r.returns)
    const users = asInt(r.users)
    if (returns == null || users == null) return null
    buckets.push({ returns, users })
  }
  return buckets
}
