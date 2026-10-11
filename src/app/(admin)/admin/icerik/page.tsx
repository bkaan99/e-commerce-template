import type { Metadata } from "next";
import { Suspense } from "react";
import { AccessDenied } from "@/components/admin/access-denied";
import { PageHeader } from "@/components/admin/page-header";
import { getContentService } from "@/modules/content/container";
import { adminPage } from "@/modules/admin/guard";
import { PERMISSIONS } from "@/shared/permissions";
import { ContentManager } from "./content-manager";

export const metadata: Metadata = { title: "İçerik" };

async function ContentContent() {
  const user = await adminPage(PERMISSIONS.CONTENT_MANAGE);
  if (!user) return <AccessDenied />;

  const content = getContentService();
  const [banners, pages, headerMenu, footerMenu] = await Promise.all([
    content.listBanners(),
    content.listPages(),
    content.menu("header"),
    content.menu("footer"),
  ]);

  return (
    <ContentManager
      banners={banners.map((banner) => ({
        ...banner,
        startsAt: banner.startsAt?.toISOString() ?? null,
        endsAt: banner.endsAt?.toISOString() ?? null,
      }))}
      pages={pages.map((page) => ({
        id: page.id,
        title: page.title,
        slug: page.slug,
        content: page.content,
        isPublished: page.isPublished,
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
      }))}
      headerMenu={headerMenu}
      footerMenu={footerMenu}
    />
  );
}

export default function AdminContentPage() {
  return (
    <>
      <PageHeader
        title="İçerik"
        description="Ana sayfa bannerları, statik sayfalar (hakkımızda, SSS…) ve menüler."
      />
      <Suspense
        fallback={<p className="text-muted-foreground">Yükleniyor...</p>}
      >
        <ContentContent />
      </Suspense>
    </>
  );
}
