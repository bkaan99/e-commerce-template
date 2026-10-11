import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors";
import type { AuditLogger } from "@/shared/audit/audit-logger";
import { slugify, uniqueSlug } from "@/shared/slug";
import type { Actor } from "../orders/admin-order.service";
import { canBeParent } from "./category.logic";
import type {
  AttributeRecord,
  BrandRecord,
  CategoryRecord,
  TaxonomyRepository,
} from "./taxonomy.repository";
import {
  attributeInputSchema,
  attributeValueSchema,
  brandInputSchema,
  categoryInputSchema,
} from "./taxonomy.schema";

function firstIssue(error: { issues: readonly { message: string }[] }): string {
  return error.issues[0]?.message ?? "Geçersiz bilgi";
}

export class TaxonomyService {
  constructor(
    private readonly repository: TaxonomyRepository,
    private readonly audit: AuditLogger,
  ) {}

  listCategories(): Promise<CategoryRecord[]> {
    return this.repository.listCategories();
  }
  listBrands(): Promise<BrandRecord[]> {
    return this.repository.listBrands();
  }
  listAttributes(): Promise<AttributeRecord[]> {
    return this.repository.listAttributes();
  }

  async saveCategory(
    id: string | null,
    raw: unknown,
    actor: Actor,
  ): Promise<string> {
    const parsed = categoryInputSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(firstIssue(parsed.error));
    const input = parsed.data;

    const all = await this.repository.listCategories();

    if (id) {
      const before = all.find((category) => category.id === id);
      if (!before) throw new NotFoundError("Kategori");

      if (!canBeParent(all, id, input.parentId)) {
        throw new ValidationError(
          "Kategori kendi alt kategorisinin altına taşınamaz",
        );
      }

      const wanted = input.slug?.trim() ? slugify(input.slug) : before.slug;
      if (
        wanted !== before.slug &&
        (await this.repository.categorySlugTaken(wanted, id))
      ) {
        throw new ConflictError("Bu adres başka bir kategoride kullanılıyor");
      }

      await this.repository.updateCategory(id, input, wanted);
      if (wanted !== before.slug) {
        await this.repository.addRedirect(
          `/kategori/${before.slug}`,
          `/kategori/${wanted}`,
        );
      }

      await this.audit.log({
        actorId: actor.userId,
        ip: actor.ip,
        action: "category.update",
        entityType: "Category",
        entityId: id,
        before: {
          name: before.name,
          slug: before.slug,
          isActive: before.isActive,
        },
        after: { name: input.name, slug: wanted, isActive: input.isActive },
      });
      return id;
    }

    if (
      input.parentId &&
      !all.some((category) => category.id === input.parentId)
    ) {
      throw new ValidationError("Üst kategori bulunamadı");
    }

    const base = input.slug?.trim() ? input.slug : input.name;
    const slug = await uniqueSlug(base, (candidate) =>
      this.repository.categorySlugTaken(candidate),
    );
    const created = await this.repository.createCategory(input, slug);

    await this.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action: "category.create",
      entityType: "Category",
      entityId: created,
      after: { name: input.name, slug },
    });
    return created;
  }

  async deleteCategory(id: string, actor: Actor): Promise<void> {
    const category = await this.repository.findCategory(id);
    if (!category) throw new NotFoundError("Kategori");

    if ((await this.repository.countCategoryChildren(id)) > 0) {
      throw new ConflictError("Alt kategorisi olan kategori silinemez");
    }
    if ((await this.repository.countCategoryProducts(id)) > 0) {
      throw new ConflictError(
        "Ürünü olan kategori silinemez; önce ürünleri taşıyın",
      );
    }

    await this.repository.deleteCategory(id);
    await this.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action: "category.delete",
      entityType: "Category",
      entityId: id,
      before: { name: category.name, slug: category.slug },
    });
  }

  async createBrand(raw: unknown, actor: Actor): Promise<string> {
    const parsed = brandInputSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(firstIssue(parsed.error));

    const slug = await uniqueSlug(parsed.data.name, (s) =>
      this.repository.brandSlugTaken(s),
    );
    const id = await this.repository.createBrand(parsed.data, slug);

    await this.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action: "brand.create",
      entityType: "Brand",
      entityId: id,
      after: { name: parsed.data.name },
    });
    return id;
  }

  async deleteBrand(id: string, actor: Actor): Promise<void> {
    await this.repository.deleteBrand(id);
    await this.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action: "brand.delete",
      entityType: "Brand",
      entityId: id,
    });
  }

  async saveAttribute(
    id: string | null,
    raw: unknown,
    actor: Actor,
  ): Promise<string> {
    const parsed = attributeInputSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(firstIssue(parsed.error));

    if (id) {
      await this.repository.updateAttribute(id, parsed.data);
      await this.audit.log({
        actorId: actor.userId,
        ip: actor.ip,
        action: "attribute.update",
        entityType: "Attribute",
        entityId: id,
        after: parsed.data,
      });
      return id;
    }

    const slug = await uniqueSlug(parsed.data.name, (s) =>
      this.repository.attributeSlugTaken(s),
    );
    const created = await this.repository.createAttribute(parsed.data, slug);
    await this.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action: "attribute.create",
      entityType: "Attribute",
      entityId: created,
      after: { name: parsed.data.name, slug },
    });
    return created;
  }

  async deleteAttribute(id: string, actor: Actor): Promise<void> {
    await this.repository.deleteAttribute(id);
    await this.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action: "attribute.delete",
      entityType: "Attribute",
      entityId: id,
    });
  }

  async addAttributeValue(
    attributeId: string,
    raw: unknown,
    actor: Actor,
  ): Promise<void> {
    const parsed = attributeValueSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(firstIssue(parsed.error));

    const slug = slugify(parsed.data.value);
    if (!slug) throw new ValidationError("Geçerli bir değer girin");
    if (await this.repository.attributeValueSlugTaken(attributeId, slug)) {
      throw new ConflictError("Bu değer zaten var");
    }

    await this.repository.addAttributeValue(
      attributeId,
      parsed.data.value,
      slug,
    );
    await this.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action: "attribute.value.add",
      entityType: "Attribute",
      entityId: attributeId,
      after: { value: parsed.data.value },
    });
  }

  async deleteAttributeValue(valueId: string, actor: Actor): Promise<void> {
    if ((await this.repository.countAttributeValueProducts(valueId)) > 0) {
      throw new ConflictError("Ürünlerde kullanılan değer silinemez");
    }
    await this.repository.deleteAttributeValue(valueId);
    await this.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action: "attribute.value.delete",
      entityType: "AttributeValue",
      entityId: valueId,
    });
  }
}
