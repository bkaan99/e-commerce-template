import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors";
import type { AuditLogger } from "@/shared/audit/audit-logger";
import { slugify, uniqueSlug } from "@/shared/slug";
import type { Actor } from "../admin/orders/admin-order.service";
import type {
  BannerView,
  ContentRepository,
  MenuItemView,
  PageView,
} from "./content.repository";
import { publishedLegalLinks } from "./legal";
import {
  bannerInputSchema,
  menuInputSchema,
  pageInputSchema,
  type MenuKey,
} from "./content.schema";

function firstIssue(error: { issues: readonly { message: string }[] }): string {
  return error.issues[0]?.message ?? "Geçersiz bilgi";
}

export class ContentService {
  constructor(
    private readonly repository: ContentRepository,
    private readonly audit: AuditLogger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  // Vitrin tarafı
  activeBanners(): Promise<BannerView[]> {
    return this.repository.listActiveBanners(this.now());
  }

  async publishedPage(slug: string): Promise<PageView> {
    const page = await this.repository.findPublishedPage(slug);
    if (!page) throw new NotFoundError("Sayfa");
    return page;
  }

  publishedPageSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    return this.repository.listPublishedPageSlugs();
  }

  /** Yayındaki yasal sayfalar (footer ve checkout bağlantıları için). */
  async legalLinks() {
    const slugs = await this.repository.listPublishedPageSlugs();
    return publishedLegalLinks(slugs.map((page) => page.slug));
  }

  menu(key: MenuKey): Promise<MenuItemView[]> {
    return this.repository.getMenu(key);
  }

  // Yönetim tarafı
  listBanners(): Promise<BannerView[]> {
    return this.repository.listBanners();
  }
  listPages(): Promise<PageView[]> {
    return this.repository.listPages();
  }

  async saveBanner(
    id: string | null,
    raw: unknown,
    actor: Actor,
  ): Promise<void> {
    const parsed = bannerInputSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(firstIssue(parsed.error));

    let savedId: string;
    if (id) {
      await this.repository.updateBanner(id, parsed.data);
      savedId = id;
    } else {
      savedId = await this.repository.createBanner(parsed.data);
    }

    await this.log(
      actor,
      id ? "banner.update" : "banner.create",
      "Banner",
      savedId,
      {
        title: parsed.data.title,
        active: parsed.data.isActive,
      },
    );
  }

  async deleteBanner(id: string, actor: Actor): Promise<void> {
    await this.repository.deleteBanner(id);
    await this.log(actor, "banner.delete", "Banner", id);
  }

  async savePage(
    id: string | null,
    raw: unknown,
    actor: Actor,
  ): Promise<string> {
    const parsed = pageInputSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(firstIssue(parsed.error));
    const input = parsed.data;

    if (id) {
      const existing = await this.repository.findPage(id);
      if (!existing) throw new NotFoundError("Sayfa");

      const slug = input.slug?.trim() ? slugify(input.slug) : existing.slug;
      if (
        slug !== existing.slug &&
        (await this.repository.pageSlugTaken(slug, id))
      ) {
        throw new ConflictError("Bu adres başka bir sayfada kullanılıyor");
      }

      await this.repository.updatePage(id, input, slug);
      await this.log(actor, "page.update", "Page", id, {
        title: input.title,
        slug,
        published: input.isPublished,
      });
      return id;
    }

    const base = input.slug?.trim() ? input.slug : input.title;
    const slug = await uniqueSlug(base, (candidate) =>
      this.repository.pageSlugTaken(candidate),
    );
    const created = await this.repository.createPage(input, slug);
    await this.log(actor, "page.create", "Page", created, {
      title: input.title,
      slug,
      published: input.isPublished,
    });
    return created;
  }

  async deletePage(id: string, actor: Actor): Promise<void> {
    await this.repository.deletePage(id);
    await this.log(actor, "page.delete", "Page", id);
  }

  async saveMenu(raw: unknown, actor: Actor): Promise<void> {
    const parsed = menuInputSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(firstIssue(parsed.error));

    await this.repository.replaceMenu(parsed.data.key, parsed.data.items);
    await this.log(actor, "menu.update", "Menu", parsed.data.key, {
      items: parsed.data.items.length,
    });
  }

  private log(
    actor: Actor,
    action: string,
    entityType: string,
    entityId: string,
    after?: unknown,
  ): Promise<void> {
    return this.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action,
      entityType,
      entityId,
      after,
    });
  }
}
