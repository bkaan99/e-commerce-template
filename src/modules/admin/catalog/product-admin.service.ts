import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors";
import type { AuditLogger } from "@/shared/audit/audit-logger";
import type { EventBus } from "@/shared/events/event-bus";
import { slugify, uniqueSlug } from "@/shared/slug";
import type { Actor } from "../orders/admin-order.service";
import type {
  EditableProduct,
  FormReferences,
  ProductAdminRepository,
  ProductListQuery,
  ProductListResult,
} from "./product-admin.repository";
import { productInputSchema, type ProductInput } from "./product.schema";

export interface FieldErrors {
  [path: string]: string;
}

export class ProductValidationError extends ValidationError {
  constructor(public readonly fieldErrors: FieldErrors) {
    super("Lütfen işaretli alanları kontrol edin");
  }
}

/** Zod hatalarını "variants.0.sku" biçiminde alan yoluna çevirir. */
export function toFieldErrors(
  issues: readonly { path: PropertyKey[]; message: string }[],
): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".");
    errors[key] ??= issue.message;
  }
  return errors;
}

export class ProductAdminService {
  constructor(
    private readonly products: ProductAdminRepository,
    private readonly events: EventBus,
    private readonly audit: AuditLogger,
  ) {}

  list(query: ProductListQuery): Promise<ProductListResult> {
    return this.products.list(query);
  }

  references(): Promise<FormReferences> {
    return this.products.references();
  }

  async get(id: string): Promise<EditableProduct> {
    const product = await this.products.findForEdit(id);
    if (!product) throw new NotFoundError("Ürün");
    return product;
  }

  async create(raw: unknown, actor: Actor): Promise<string> {
    const input = this.parse(raw);
    const slug = await this.resolveSlug(input);

    const id = await this.products.create(input, slug);
    await this.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action: "product.create",
      entityType: "Product",
      entityId: id,
      after: { name: input.name, slug, status: input.status },
    });
    return id;
  }

  async update(id: string, raw: unknown, actor: Actor): Promise<void> {
    const input = this.parse(raw);
    const before = await this.get(id);

    const requestedSlug = input.slug?.trim()
      ? slugify(input.slug)
      : before.slug;
    if (requestedSlug !== before.slug) {
      if (await this.products.slugTaken(requestedSlug, id)) {
        throw new ProductValidationError({
          slug: "Bu adres başka bir üründe kullanılıyor",
        });
      }
    }
    const slug = requestedSlug || before.slug;

    await this.products.update(id, input, slug);

    if (slug !== before.slug) {
      // Eski adres aramada ve dış bağlantılarda kırılmasın.
      await this.products.addRedirect(`/urun/${before.slug}`, `/urun/${slug}`);
    }

    await this.audit.log({
      actorId: actor.userId,
      ip: actor.ip,
      action: "product.update",
      entityType: "Product",
      entityId: id,
      before: this.snapshot(before),
      after: this.inputSnapshot(input, slug),
    });

    await this.publishReplenished(before, input);
  }

  /** Kaydetmeden doğrular; hatalarda ProductValidationError fırlatır. */
  validate(raw: unknown): ProductInput {
    return this.parse(raw);
  }

  private parse(raw: unknown): ProductInput {
    const result = productInputSchema.safeParse(raw);
    if (!result.success) {
      throw new ProductValidationError(toFieldErrors(result.error.issues));
    }
    return result.data;
  }

  private async resolveSlug(input: ProductInput): Promise<string> {
    const wanted = input.slug?.trim() ? slugify(input.slug) : input.name;
    if (
      input.slug?.trim() &&
      (await this.products.slugTaken(slugify(wanted)))
    ) {
      throw new ConflictError("Bu adres başka bir üründe kullanılıyor");
    }
    return uniqueSlug(wanted, (candidate) =>
      this.products.slugTaken(candidate),
    );
  }

  /** 0'dan fazlaya çıkan stoklar için yeniden stokta olayı yayınlar. */
  private async publishReplenished(
    before: EditableProduct,
    input: ProductInput,
  ): Promise<void> {
    const previous = new Map(
      before.variants.map((v) => [v.id, v.stockQuantity]),
    );
    for (const variant of input.variants) {
      if (!variant.id) continue;
      const old = previous.get(variant.id);
      if (old !== undefined && old <= 0 && variant.stockQuantity > 0) {
        await this.events.publish("stock.replenished", {
          variantId: variant.id,
        });
      }
    }
  }

  private snapshot(product: EditableProduct) {
    return {
      name: product.name,
      slug: product.slug,
      status: product.status,
      variants: product.variants.map((v) => ({
        sku: v.sku,
        price: v.price,
        stock: v.stockQuantity,
        active: v.isActive,
      })),
    };
  }

  private inputSnapshot(input: ProductInput, slug: string) {
    return {
      name: input.name,
      slug,
      status: input.status,
      variants: input.variants.map((v) => ({
        sku: v.sku,
        price: v.price,
        stock: v.stockQuantity,
        active: v.isActive,
      })),
    };
  }
}
