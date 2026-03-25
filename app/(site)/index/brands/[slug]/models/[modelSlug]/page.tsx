import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { BoardModelPageView } from "@/components/index-directory/board-model-page-view"
import {
  getAllBrandModelStaticParams,
  getBrandModelPagePayload,
} from "@/lib/index-directory/model-details-registry"

export const revalidate = 3600

export function generateStaticParams() {
  return getAllBrandModelStaticParams()
}

type Props = { params: Promise<{ slug: string; modelSlug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, modelSlug } = await params
  const payload = getBrandModelPagePayload(slug, modelSlug)
  if (!payload) {
    return { title: "Model" }
  }
  const { brand, model } = payload
  return {
    title: `${model.name} — ${brand.name}`,
    description: payload.detail?.descriptionParagraphs[0] ?? `${model.name} by ${brand.name}. View specs and shop the line.`,
  }
}

export default async function BrandModelPage({ params }: Props) {
  const { slug, modelSlug } = await params
  const payload = getBrandModelPagePayload(slug, modelSlug)
  if (!payload) {
    notFound()
  }
  return <BoardModelPageView brand={payload.brand} model={payload.model} detail={payload.detail} />
}
