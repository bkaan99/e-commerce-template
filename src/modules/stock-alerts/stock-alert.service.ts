import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors";
import { availableQuantity } from "../catalog/availability";
import { createSignedToken, verifySignedToken } from "../auth/signed-token";

export const PURPOSE_UNSUBSCRIBE_STOCK_ALERT = "unsubscribe-stock-alert";
const UNSUBSCRIBE_TTL_SECONDS = 60 * 60 * 24 * 365;

export interface AlertVariantRecord {
  variantId: string;
  isActive: boolean;
  productActive: boolean;
  productName: string;
  productSlug: string;
  trackInventory: boolean;
  stockQuantity: number;
  reservedQuantity: number;
}

export interface PendingSubscription {
  id: string;
  email: string;
  variant: AlertVariantRecord;
}

export interface StockAlertRepository {
  findVariant(variantId: string): Promise<AlertVariantRecord | null>;
  /** Aynı e-posta ve varyant için kayıt varsa yenisini oluşturmaz. */
  upsertSubscription(variantId: string, email: string): Promise<void>;
  listPending(limit: number): Promise<PendingSubscription[]>;
  listPendingForVariant(variantId: string): Promise<PendingSubscription[]>;
  markNotified(subscriptionIds: string[]): Promise<void>;
  deleteSubscription(subscriptionId: string): Promise<void>;
}

export interface StockAlertMailer {
  sendStockAvailable(
    email: string,
    product: { name: string; slug: string },
    unsubscribeUrl: string,
  ): Promise<void>;
}

export interface StockAlertDeps {
  alerts: StockAlertRepository;
  mailer: StockAlertMailer;
  secret: string;
  baseUrl: string;
  now?: () => Date;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isAvailable(variant: AlertVariantRecord): boolean {
  if (!variant.isActive || !variant.productActive) return false;
  const quantity = availableQuantity({
    trackInventory: variant.trackInventory,
    stockQuantity: variant.stockQuantity,
    reservedQuantity: variant.reservedQuantity,
  });
  return quantity === null || quantity > 0;
}

export class StockAlertService {
  private readonly now: () => Date;

  constructor(private readonly deps: StockAlertDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async subscribe(variantId: string, email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalized) || normalized.length > 254) {
      throw new ValidationError("Geçerli bir e-posta girin");
    }

    const variant = await this.deps.alerts.findVariant(variantId);
    if (!variant || !variant.isActive || !variant.productActive) {
      throw new NotFoundError("Ürün");
    }
    if (isAvailable(variant)) {
      throw new ConflictError("Bu ürün şu anda stokta");
    }

    await this.deps.alerts.upsertSubscription(variantId, normalized);
  }

  /** Stoğa giren varyantların abonelerine bildirim gönderir; gönderilen sayıyı döner. */
  async notifyAvailable(variantId?: string): Promise<number> {
    const pending = variantId
      ? await this.deps.alerts.listPendingForVariant(variantId)
      : await this.deps.alerts.listPending(500);

    const ready = pending.filter((item) => isAvailable(item.variant));
    for (const item of ready) {
      await this.deps.mailer.sendStockAvailable(
        item.email,
        { name: item.variant.productName, slug: item.variant.productSlug },
        this.unsubscribeUrl(item.id),
      );
    }

    await this.deps.alerts.markNotified(ready.map((item) => item.id));
    return ready.length;
  }

  async unsubscribe(token: string): Promise<void> {
    const result = verifySignedToken(token, {
      secret: this.deps.secret,
      purpose: PURPOSE_UNSUBSCRIBE_STOCK_ALERT,
      now: this.now(),
    });
    if (!result.valid) {
      throw new ValidationError("Bağlantı geçersiz veya süresi dolmuş");
    }

    await this.deps.alerts.deleteSubscription(result.payload.subject);
  }

  private unsubscribeUrl(subscriptionId: string): string {
    const token = createSignedToken(
      { purpose: PURPOSE_UNSUBSCRIBE_STOCK_ALERT, subject: subscriptionId },
      {
        secret: this.deps.secret,
        ttlSeconds: UNSUBSCRIBE_TTL_SECONDS,
        now: this.now(),
      },
    );
    return `${this.deps.baseUrl}/bildirim-iptal?token=${encodeURIComponent(token)}`;
  }
}
