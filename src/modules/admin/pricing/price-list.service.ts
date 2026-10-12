import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors";
import type { AuditLogger } from "@/shared/audit/audit-logger";
import { uniqueSlug } from "@/shared/slug";
import type { Actor } from "../orders/admin-order.service";
import type {
  GroupRow,
  PriceListRepository,
  VariantPriceRow,
} from "./price-list.repository";
import {
  groupInputSchema,
  groupPriceSchema,
  tierListSchema,
} from "./price-list.schema";

function firstIssue(error: { issues: readonly { message: string }[] }): string {
  return error.issues[0]?.message ?? "Geçersiz bilgi";
}

export class PriceListService {
  constructor(
    private readonly repository: PriceListRepository,
    private readonly audit: AuditLogger,
  ) {}

  listGroups(): Promise<GroupRow[]> {
    return this.repository.listGroups();
  }

  searchVariants(groupId: string, query: string): Promise<VariantPriceRow[]> {
    return this.repository.searchVariants(groupId, query, 40);
  }

  async saveGroup(
    id: string | null,
    raw: unknown,
    actor: Actor,
  ): Promise<string> {
    const parsed = groupInputSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(firstIssue(parsed.error));
    const { name, discountPercent } = parsed.data;

    if (id) {
      const existing = await this.repository.findGroup(id);
      if (!existing) throw new NotFoundError("Müşteri grubu");

      await this.repository.updateGroup(id, name, discountPercent);
      await this.log(
        actor,
        "customer-group.update",
        id,
        {
          name,
          discountPercent,
        },
        { name: existing.name, discountPercent: existing.discountPercent },
      );
      return id;
    }

    const slug = await uniqueSlug(name, (candidate) =>
      this.repository.groupSlugTaken(candidate),
    );
    const created = await this.repository.createGroup(
      name,
      slug,
      discountPercent,
    );
    await this.log(actor, "customer-group.create", created, {
      name,
      discountPercent,
    });
    return created;
  }

  async deleteGroup(id: string, actor: Actor): Promise<void> {
    const group = await this.repository.findGroup(id);
    if (!group) throw new NotFoundError("Müşteri grubu");
    if (group.customerCount > 0) {
      throw new ConflictError(
        "Bayisi olan grup silinemez; önce bayileri başka gruba taşıyın",
      );
    }

    await this.repository.deleteGroup(id);
    await this.log(actor, "customer-group.delete", id, undefined, {
      name: group.name,
    });
  }

  /** Varyanta özel grup fiyatını ayarlar; `null` fiyatı kaldırır. */
  async setGroupPrice(
    groupId: string,
    variantId: string,
    rawPrice: unknown,
    actor: Actor,
  ): Promise<void> {
    const parsed = groupPriceSchema.safeParse(rawPrice);
    if (!parsed.success) throw new ValidationError(firstIssue(parsed.error));

    if (!(await this.repository.findGroup(groupId))) {
      throw new NotFoundError("Müşteri grubu");
    }
    if (!(await this.repository.variantExists(variantId))) {
      throw new NotFoundError("Varyant");
    }

    await this.repository.setGroupPrice(groupId, variantId, parsed.data);
    await this.log(actor, "price-list.group-price", variantId, {
      groupId,
      price: parsed.data,
    });
  }

  /** Bir varyantın bu gruba (veya `groupId` null ise herkese) özel kademelerini baştan yazar. */
  async setTiers(
    groupId: string | null,
    variantId: string,
    rawTiers: unknown,
    actor: Actor,
  ): Promise<void> {
    const parsed = tierListSchema.safeParse(rawTiers);
    if (!parsed.success) throw new ValidationError(firstIssue(parsed.error));

    if (groupId && !(await this.repository.findGroup(groupId))) {
      throw new NotFoundError("Müşteri grubu");
    }
    if (!(await this.repository.variantExists(variantId))) {
      throw new NotFoundError("Varyant");
    }

    await this.repository.replaceTiers(variantId, groupId, parsed.data);
    await this.log(actor, "price-list.tiers", variantId, {
      groupId,
      tiers: parsed.data,
    });
  }

  private log(
    actor: Actor,
    action: string,
    entityId: string,
    after?: unknown,
    before?: unknown,
  ): Promise<void> {
    return this.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action,
      entityType: action.startsWith("customer-group")
        ? "CustomerGroup"
        : "ProductVariant",
      entityId,
      before,
      after,
    });
  }
}
