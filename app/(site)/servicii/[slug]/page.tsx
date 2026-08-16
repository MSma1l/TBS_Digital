import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { directions } from "@/lib/directions";
import { DirectionPage } from "@/components/sections/DirectionPage";

export function generateStaticParams() {
  return directions.map((d) => ({ slug: d.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { title: `TBS Digital \u2014 ${slug}` };
}

export default async function SolutionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dir = directions.find((d) => d.slug === slug);
  if (!dir) notFound();
  return <DirectionPage slug={slug} />;
}
