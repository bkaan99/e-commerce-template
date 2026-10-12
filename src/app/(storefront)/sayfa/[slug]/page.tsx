import { absoluteUrl } from "@/shared/site-url";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RichText } from "@/components/content/rich-text";
import { getContentService } from "@/modules/content/container";
import { isAppError } from "@/shared/errors";

async function loadPage(slug: string) {
  try {
    return await getContentService().publishedPage(slug);
  } catch (error) {
    if (isAppError(error)) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/sayfa/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadPage(slug);
  if (!page) return {};

  return {
    title: page.seoTitle ?? page.title,
    description: page.seoDescription ?? undefined,
    alternates: { canonical: absoluteUrl(`/sayfa/${page.slug}`) },
  };
}

async function PageContent({
  params,
}: Pick<PageProps<"/sayfa/[slug]">, "params">) {
  const { slug } = await params;
  const page = await loadPage(slug);
  if (!page) notFound();

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-3xl font-semibold">{page.title}</h1>
      <RichText source={page.content} />
    </article>
  );
}

export default function StaticPage({ params }: PageProps<"/sayfa/[slug]">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Yükleniyor...</p>}>
      <PageContent params={params} />
    </Suspense>
  );
}
