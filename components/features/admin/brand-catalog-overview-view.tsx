import Image from "next/image"
import Link from "next/link"
import type { BrandCatalogBrandNode } from "@/lib/services/brandCatalogOverview"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Boxes, ChevronDown, Layers, Link2 } from "lucide-react"
import type { BrandModelVariantRow } from "@/lib/db/brand-model-variants"

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id
}

function formatCondition(condition: BrandModelVariantRow["condition"]): string {
  return condition.replace(/_/g, " ")
}

function DimensionFlow() {
  return (
    <div className="mb-8 rounded-lg border border-muted bg-muted/30 p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-foreground">How rows connect (foreign keys)</p>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex flex-1 flex-col rounded-md border bg-background px-4 py-3 shadow-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">brands</span>
          <span className="mt-1 text-sm font-semibold text-foreground">Brand directory</span>
          <span className="mt-2 font-mono text-xs text-muted-foreground">PRIMARY KEY · id</span>
        </div>
        <div className="hidden shrink-0 text-muted-foreground sm:block" aria-hidden>
          <Layers className="h-8 w-8 rotate-90 sm:rotate-0" />
          <span className="sr-only">one to many</span>
        </div>
        <div className="flex flex-1 flex-col rounded-md border bg-background px-4 py-3 shadow-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">brand_models</span>
          <span className="mt-1 text-sm font-semibold text-foreground">Board models</span>
          <span className="mt-2 font-mono text-xs text-muted-foreground">brand_models.brand_id → brands.id</span>
        </div>
        <div className="hidden shrink-0 text-muted-foreground sm:block" aria-hidden>
          <Layers className="h-8 w-8 rotate-90 sm:rotate-0" />
        </div>
        <div className="flex flex-1 flex-col rounded-md border bg-background px-4 py-3 shadow-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            brand_model_variants
          </span>
          <span className="mt-1 text-sm font-semibold text-foreground">Size / fins / condition</span>
          <span className="mt-2 font-mono text-xs text-muted-foreground">
            variants.brand_id → brands.id · variants.brand_model_id → brand_models.id
          </span>
        </div>
      </div>
    </div>
  )
}

export function BrandCatalogOverviewView(props: {
  stats: { brands: number; models: number; variants: number }
  nodes: BrandCatalogBrandNode[]
}) {
  const { stats, nodes } = props

  return (
    <>
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Brand catalog explorer</h1>
        <p className="max-w-3xl text-muted-foreground">
          Read-only snapshot of <span className="font-medium text-foreground">brands</span> →{" "}
          <span className="font-medium text-foreground">brand_models</span> →{" "}
          <span className="font-medium text-foreground">brand_model_variants</span>. Expand a brand to see its catalog
          models and variants; each model lists every variant (size / fins / condition) underneath.
        </p>
      </div>

      <DimensionFlow />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Brands</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{stats.brands}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Models</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{stats.models}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Variants</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{stats.variants}</p>
          </CardContent>
        </Card>
      </div>

      {nodes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No brands in the database yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {nodes.map(({ brand, models }) => (
            <details
              key={brand.id}
              className="group overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm"
            >
              <summary className="flex cursor-pointer list-none items-start gap-3 border-b border-border bg-muted/20 p-4 marker:content-none [&::-webkit-details-marker]:hidden sm:items-center">
                <ChevronDown className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition group-open:rotate-180 sm:mt-0" />
                <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    {brand.logo_url ? (
                      <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md border bg-muted">
                        <Image
                          src={brand.logo_url}
                          alt={`${brand.name} logo`}
                          fill
                          className="object-contain p-0.5"
                          sizes="44px"
                        />
                      </span>
                    ) : (
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                        <Boxes className="h-5 w-5" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="text-lg font-semibold leading-tight text-foreground">{brand.name}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-mono">{brand.slug}</span>
                        <span aria-hidden>|</span>
                        <span>brands.id {shortId(brand.id)}</span>
                        <span aria-hidden>|</span>
                        <span>
                          Stored model_count {brand.model_count} · catalog models loaded {models.length}
                        </span>
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`${BRANDS_BASE}/${encodeURIComponent(brand.slug)}`}
                    className="inline-flex shrink-0 items-center gap-1 self-start rounded-md px-2 py-1 text-sm text-primary underline-offset-4 hover:underline sm:self-center"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Public profile
                  </Link>
                </div>
              </summary>

              <div className="px-4 py-5">
                {models.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No rows in brand_models for this brand.
                  </p>
                ) : (
                  <>
                    <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Models ({models.length})
                    </p>
                    <div className="space-y-5 border-l-2 border-primary/30 pl-4">
                      {models.map(({ model, variants }) => (
                        <div key={model.id} className="rounded-md border bg-background p-4 shadow-sm">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <span className="text-base font-semibold text-foreground">{model.name}</span>
                            <span className="text-xs font-mono text-muted-foreground">
                              brand_models.id {shortId(model.id)}
                            </span>
                            <span className="text-xs text-muted-foreground">· links to brands.id {shortId(brand.id)}</span>
                          </div>
                          {model.description?.trim() ? (
                            <p className="mt-2 line-clamp-4 text-sm text-muted-foreground">{model.description}</p>
                          ) : null}

                          <div className="mt-4">
                            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Variants for this model ({variants.length})
                            </p>
                            {variants.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No rows in brand_model_variants.</p>
                            ) : (
                              <div className="overflow-x-auto rounded-md border">
                                <table className="w-full min-w-[640px] border-collapse bg-background text-left text-sm">
                                  <thead>
                                    <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                                      <th className="px-3 py-2.5 font-medium">Variant id</th>
                                      <th className="px-3 py-2.5 font-medium">Dims (L × W × T / vol)</th>
                                      <th className="px-3 py-2.5 font-medium">Fin box</th>
                                      <th className="px-3 py-2.5 font-medium">Condition</th>
                                      <th className="px-3 py-2.5 font-medium">Price</th>
                                      <th className="px-3 py-2.5 font-medium">FKs</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {variants.map((v) => (
                                      <tr key={v.id} className="border-b border-muted/60 last:border-0">
                                        <td className="px-3 py-2.5 font-mono text-xs align-top">{shortId(v.id)}</td>
                                        <td className="px-3 py-2.5 align-top tabular-nums">
                                          {v.length_label} × {v.width_label} × {v.thickness_label} / {v.volume_label}
                                        </td>
                                        <td className="px-3 py-2.5 align-top capitalize">
                                          {v.fin_box_type.replace(/_/g, " ")}
                                        </td>
                                        <td className="px-3 py-2.5 align-top">{formatCondition(v.condition)}</td>
                                        <td className="px-3 py-2.5 align-top tabular-nums">
                                          {v.price != null ? `$${v.price.toFixed(2)}` : "—"}
                                        </td>
                                        <td className="px-3 py-2.5 align-top font-mono text-xs text-muted-foreground">
                                          brand_model_id→{shortId(v.brand_model_id)}
                                          <br />
                                          brand_id→{shortId(v.brand_id)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
    </>
  )
}
