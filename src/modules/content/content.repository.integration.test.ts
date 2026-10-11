import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient, type PrismaClient } from "@/shared/prisma-client";
import { PrismaContentRepository } from "./content.repository";
import { bannerInputSchema } from "./content.schema";

describe("PrismaContentRepository", () => {
  const tag = randomUUID().slice(0, 8);
  let db: PrismaClient;
  let repo: PrismaContentRepository;

  beforeAll(() => {
    db = createPrismaClient(process.env["TEST_DATABASE_URL"]!);
    repo = new PrismaContentRepository(() => db);
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("yalnızca aktif ve tarih aralığı uygun bannerları döndürür", async () => {
    const now = new Date("2026-06-15T12:00:00Z");
    const make = (title: string, extra: Record<string, unknown> = {}) =>
      repo.createBanner(
        bannerInputSchema.parse({
          title: `${title} ${tag}`,
          imageUrl: "/img/a.jpg",
          ...extra,
        }),
      );

    await make("Aktif");
    await make("Pasif", { isActive: false });
    await make("Gelecek", { startsAt: "2026-07-01T00:00" });
    await make("Geçmiş", { endsAt: "2026-06-01T00:00" });
    await make("İçinde", {
      startsAt: "2026-06-01T00:00",
      endsAt: "2026-06-30T00:00",
    });

    const titles = (await repo.listActiveBanners(now))
      .map((banner) => banner.title)
      .filter((title) => title.endsWith(tag));

    expect(titles.sort()).toEqual([`Aktif ${tag}`, `İçinde ${tag}`].sort());
  });

  it("menüyü baştan yazar ve sırayı korur", async () => {
    await repo.replaceMenu("footer", [
      { label: "A", url: "/a" },
      { label: "B", url: "/b" },
      { label: "C", url: "/c" },
    ]);
    expect((await repo.getMenu("footer")).map((item) => item.label)).toEqual([
      "A",
      "B",
      "C",
    ]);

    await repo.replaceMenu("footer", [{ label: "Yalnız", url: "/y" }]);
    expect(await repo.getMenu("footer")).toEqual([
      { label: "Yalnız", url: "/y" },
    ]);

    await repo.replaceMenu("footer", []);
    expect(await repo.getMenu("footer")).toEqual([]);
  });

  it("yalnızca yayındaki sayfayı bulur; slug çakışmasını bildirir", async () => {
    const slug = `hakkimizda-${tag}`;
    const id = await repo.createPage(
      {
        title: "Hakkımızda",
        content: "# Merhaba",
        isPublished: false,
        seoTitle: null,
        seoDescription: null,
      },
      slug,
    );

    expect(await repo.findPublishedPage(slug)).toBeNull();
    expect(await repo.pageSlugTaken(slug)).toBe(true);
    expect(await repo.pageSlugTaken(slug, id)).toBe(false);

    await repo.updatePage(
      id,
      {
        title: "Hakkımızda",
        content: "# Merhaba",
        isPublished: true,
        seoTitle: null,
        seoDescription: null,
      },
      slug,
    );
    expect((await repo.findPublishedPage(slug))?.title).toBe("Hakkımızda");
  });
});
