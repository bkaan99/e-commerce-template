import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { getCachedBanners } from "@/modules/content/cached";

/** Ana sayfa bannerları; yalnızca aktif ve tarih aralığı uygun olanlar. */
export async function BannerGrid() {
  await connection();
  const banners = (await getCachedBanners()).slice(0, 4);
  if (banners.length === 0) return null;

  // Tailwind dinamik sınıf adlarını derlemediği için sınıflar açıkça yazılır.
  const columns =
    banners.length === 1
      ? "grid"
      : banners.length === 2
        ? "grid gap-4 sm:grid-cols-2"
        : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section aria-label="Kampanyalar" className={columns}>
      {banners.map((banner) => {
        const content = (
          <div className="relative aspect-[16/6] overflow-hidden rounded-theme bg-muted">
            <Image
              src={banner.imageUrl}
              alt={banner.title}
              fill
              sizes="(min-width: 1024px) 33vw, 100vw"
              className="object-cover"
            />
          </div>
        );

        return banner.linkUrl ? (
          <Link key={banner.id} href={banner.linkUrl} aria-label={banner.title}>
            {content}
          </Link>
        ) : (
          <div key={banner.id}>{content}</div>
        );
      })}
    </section>
  );
}
