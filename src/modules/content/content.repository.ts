import type { PrismaClient } from "@/shared/prisma-client";
import type { BannerInput, MenuKey, PageInput } from "./content.schema";

export interface BannerView {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
  sortOrder: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}

export interface PageView {
  id: string;
  title: string;
  slug: string;
  content: string;
  isPublished: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: Date;
}

export interface MenuItemView {
  label: string;
  url: string;
}

export interface ContentRepository {
  listBanners(): Promise<BannerView[]>;
  listActiveBanners(now: Date): Promise<BannerView[]>;
  createBanner(input: BannerInput): Promise<string>;
  updateBanner(id: string, input: BannerInput): Promise<void>;
  deleteBanner(id: string): Promise<void>;

  listPages(): Promise<PageView[]>;
  findPublishedPage(slug: string): Promise<PageView | null>;
  listPublishedPageSlugs(): Promise<{ slug: string; updatedAt: Date }[]>;
  pageSlugTaken(slug: string, excludeId?: string): Promise<boolean>;
  findPage(id: string): Promise<PageView | null>;
  createPage(input: PageInput, slug: string): Promise<string>;
  updatePage(id: string, input: PageInput, slug: string): Promise<void>;
  deletePage(id: string): Promise<void>;

  getMenu(key: MenuKey): Promise<MenuItemView[]>;
  replaceMenu(key: MenuKey, items: MenuItemView[]): Promise<void>;
}

export class PrismaContentRepository implements ContentRepository {
  constructor(private readonly db: () => PrismaClient) {}

  private banner(row: {
    id: string;
    title: string;
    imageUrl: string;
    linkUrl: string | null;
    sortOrder: number;
    startsAt: Date | null;
    endsAt: Date | null;
    isActive: boolean;
  }): BannerView {
    return { ...row };
  }

  async listBanners(): Promise<BannerView[]> {
    const rows = await this.db().banner.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return rows.map((row) => this.banner(row));
  }

  async listActiveBanners(now: Date): Promise<BannerView[]> {
    const rows = await this.db().banner.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return rows.map((row) => this.banner(row));
  }

  async createBanner(input: BannerInput): Promise<string> {
    const created = await this.db().banner.create({
      data: input,
      select: { id: true },
    });
    return created.id;
  }

  async updateBanner(id: string, input: BannerInput): Promise<void> {
    await this.db().banner.update({ where: { id }, data: input });
  }

  async deleteBanner(id: string): Promise<void> {
    await this.db().banner.delete({ where: { id } });
  }

  private page(row: {
    id: string;
    title: string;
    slug: string;
    content: string;
    isPublished: boolean;
    seoTitle: string | null;
    seoDescription: string | null;
    updatedAt: Date;
  }): PageView {
    return { ...row };
  }

  async listPages(): Promise<PageView[]> {
    const rows = await this.db().page.findMany({ orderBy: { title: "asc" } });
    return rows.map((row) => this.page(row));
  }

  async findPublishedPage(slug: string): Promise<PageView | null> {
    const row = await this.db().page.findFirst({
      where: { slug, isPublished: true },
    });
    return row ? this.page(row) : null;
  }

  listPublishedPageSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    return this.db().page.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
    });
  }

  async pageSlugTaken(slug: string, excludeId?: string): Promise<boolean> {
    const found = await this.db().page.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    return found !== null;
  }

  async findPage(id: string): Promise<PageView | null> {
    const row = await this.db().page.findUnique({ where: { id } });
    return row ? this.page(row) : null;
  }

  async createPage(input: PageInput, slug: string): Promise<string> {
    const created = await this.db().page.create({
      data: { ...input, slug },
      select: { id: true },
    });
    return created.id;
  }

  async updatePage(id: string, input: PageInput, slug: string): Promise<void> {
    await this.db().page.update({ where: { id }, data: { ...input, slug } });
  }

  async deletePage(id: string): Promise<void> {
    await this.db().page.delete({ where: { id } });
  }

  async getMenu(key: MenuKey): Promise<MenuItemView[]> {
    const menu = await this.db().menu.findUnique({
      where: { key },
      include: { items: { orderBy: { position: "asc" } } },
    });
    return (
      menu?.items.map((item) => ({ label: item.label, url: item.url })) ?? []
    );
  }

  async replaceMenu(key: MenuKey, items: MenuItemView[]): Promise<void> {
    await this.db().$transaction(async (tx) => {
      const menu = await tx.menu.upsert({
        where: { key },
        update: {},
        create: { key },
        select: { id: true },
      });
      await tx.menuItem.deleteMany({ where: { menuId: menu.id } });
      if (items.length > 0) {
        await tx.menuItem.createMany({
          data: items.map((item, position) => ({
            menuId: menu.id,
            label: item.label,
            url: item.url,
            position,
          })),
        });
      }
    });
  }
}
