import { geoAlbersUsa, geoCentroid, geoPath } from "d3-geo"
import { feature } from "topojson-client"
import type { Feature, FeatureCollection, Geometry } from "geojson"
import usStatesTopology from "@/lib/data/us-states-10m.json"
import { BRAND_CTA_BLUE } from "@/lib/brand-colors"
import type { MarketplaceSalesMapPayload } from "@/lib/types/marketplace-sales-map"

export const USA_SALES_MAP_WIDTH = 960
export const USA_SALES_MAP_HEIGHT = 600

export type UsaSalesMapStatePath = {
  code: string
  name: string
  d: string
}

export type UsaSalesMapFlowPath = {
  sellerState: string
  buyerState: string
  count: number
  volumeUsd: number
  d: string
  width: number
  opacity: number
}

export type UsaSalesMapStateDot = {
  code: string
  cx: number
  cy: number
  radius: number
  fill: string
}

export type UsaSalesMapGeometry = {
  width: number
  height: number
  statePaths: UsaSalesMapStatePath[]
  flowPaths: UsaSalesMapFlowPath[]
  stateDots: UsaSalesMapStateDot[]
}

type StateFeature = Feature<Geometry, { name: string }>

/** Census FIPS → two-letter state code (50 states + DC + PR). */
const FIPS_TO_STATE: Record<string, string> = {
  "01": "AL",
  "02": "AK",
  "04": "AZ",
  "05": "AR",
  "06": "CA",
  "08": "CO",
  "09": "CT",
  "10": "DE",
  "11": "DC",
  "12": "FL",
  "13": "GA",
  "15": "HI",
  "16": "ID",
  "17": "IL",
  "18": "IN",
  "19": "IA",
  "20": "KS",
  "21": "KY",
  "22": "LA",
  "23": "ME",
  "24": "MD",
  "25": "MA",
  "26": "MI",
  "27": "MN",
  "28": "MS",
  "29": "MO",
  "30": "MT",
  "31": "NE",
  "32": "NV",
  "33": "NH",
  "34": "NJ",
  "35": "NM",
  "36": "NY",
  "37": "NC",
  "38": "ND",
  "39": "OH",
  "40": "OK",
  "41": "OR",
  "42": "PA",
  "44": "RI",
  "45": "SC",
  "46": "SD",
  "47": "TN",
  "48": "TX",
  "49": "UT",
  "50": "VT",
  "51": "VA",
  "53": "WA",
  "54": "WV",
  "55": "WI",
  "56": "WY",
  "72": "PR",
}

const COORD_PRECISION = 2

function roundCoord(value: number): number {
  const factor = 10 ** COORD_PRECISION
  return Math.round(value * factor) / factor
}

function roundPoint(point: [number, number]): [number, number] {
  return [roundCoord(point[0]), roundCoord(point[1])]
}

/** Normalize SVG path numbers so SSR and client markup stay identical. */
function roundSvgPath(path: string): string {
  return path.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, (match) => {
    const parsed = Number(match)
    return Number.isFinite(parsed) ? roundCoord(parsed).toFixed(COORD_PRECISION) : match
  })
}

function stateCodeFromFeature(stateFeature: StateFeature): string | null {
  const fips = (stateFeature.id ?? "").toString().padStart(2, "0")
  return FIPS_TO_STATE[fips] ?? null
}

function flowArcPath(
  start: [number, number],
  end: [number, number],
  curvature = 0.22,
): string {
  const [x0, y0] = start
  const [x1, y1] = end
  const mx = (x0 + x1) / 2
  const my = (y0 + y1) / 2
  const dx = x1 - x0
  const dy = y1 - y0
  const ox = mx - dy * curvature
  const oy = my + dx * curvature
  return roundSvgPath(`M ${x0} ${y0} Q ${ox} ${oy} ${x1} ${y1}`)
}

export function buildUsaSalesMapGeometry(
  data: Pick<MarketplaceSalesMapPayload, "flows" | "stateStats">,
): UsaSalesMapGeometry {
  const topology = usStatesTopology as unknown as Parameters<typeof feature>[0]
  const states = feature(
    topology,
    topology.objects.states as Parameters<typeof feature>[1],
  ) as unknown as FeatureCollection<Geometry, { name: string }>

  const projection = geoAlbersUsa()
    .scale(1280)
    .translate([USA_SALES_MAP_WIDTH / 2, USA_SALES_MAP_HEIGHT / 2])

  const pathGenerator = geoPath(projection)
  const centroids = new Map<string, [number, number]>()

  const statePaths: UsaSalesMapStatePath[] = []
  for (const stateFeature of states.features) {
    const code = stateCodeFromFeature(stateFeature as StateFeature)
    if (!code) continue

    const d = roundSvgPath(pathGenerator(stateFeature) ?? "")
    const centroid = pathGenerator.centroid(stateFeature)
    if (Number.isFinite(centroid[0]) && Number.isFinite(centroid[1])) {
      centroids.set(code, roundPoint([centroid[0], centroid[1]]))
    } else {
      const raw = geoCentroid(stateFeature)
      const projected = projection(raw)
      if (projected) centroids.set(code, roundPoint(projected))
    }

    statePaths.push({
      code,
      d,
      name: stateFeature.properties?.name ?? code,
    })
  }

  const maxFlowCount = Math.max(1, ...data.flows.map((flow) => flow.count))
  const maxStateActivity = Math.max(
    1,
    ...data.stateStats.map((row) => row.asSeller + row.asBuyer),
  )

  const flowPaths: UsaSalesMapFlowPath[] = []
  for (const flow of data.flows) {
    if (flow.sellerState === flow.buyerState) continue
    const start = centroids.get(flow.sellerState)
    const end = centroids.get(flow.buyerState)
    if (!start || !end) continue

    flowPaths.push({
      sellerState: flow.sellerState,
      buyerState: flow.buyerState,
      count: flow.count,
      volumeUsd: flow.volumeUsd,
      d: flowArcPath(start, end),
      width: roundCoord(1 + (flow.count / maxFlowCount) * 5),
      opacity: roundCoord(0.18 + (flow.count / maxFlowCount) * 0.72),
    })
  }

  const stateStatsByCode = new Map(data.stateStats.map((row) => [row.state, row]))
  const stateDots: UsaSalesMapStateDot[] = []
  for (const state of statePaths) {
    const stat = stateStatsByCode.get(state.code)
    const centroid = centroids.get(state.code)
    if (!stat || !centroid) continue

    stateDots.push({
      code: state.code,
      cx: centroid[0],
      cy: centroid[1],
      radius: roundCoord(2 + ((stat.asSeller + stat.asBuyer) / maxStateActivity) * 5),
      fill: BRAND_CTA_BLUE,
    })
  }

  return {
    width: USA_SALES_MAP_WIDTH,
    height: USA_SALES_MAP_HEIGHT,
    statePaths,
    flowPaths,
    stateDots,
  }
}
