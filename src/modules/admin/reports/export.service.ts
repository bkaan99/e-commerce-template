import { toCsv } from "@/shared/csv";
import type { PrismaClient } from "@/shared/prisma-client";

const MAX_ROWS = 20_000;

export class ExportService {
  constructor(private readonly db: () => PrismaClient) {}

  /** Siparişleri satır bazında (her ürün bir satır) CSV olarak döndürür. */
  async ordersCsv(range: { from?: Date; to?: Date } = {}): Promise<string> {
    const orders = await this.db().order.findMany({
      where: {
        ...(range.from || range.to
          ? { createdAt: { gte: range.from, lte: range.to } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
      include: { items: true },
    });

    const rows: unknown[][] = [];
    for (const order of orders) {
      const address = (order.shippingAddress ?? {}) as Record<
        string,
        string | null
      >;
      for (const item of order.items) {
        rows.push([
          order.orderNumber,
          order.createdAt,
          order.status,
          order.paymentStatus,
          order.guestEmail ?? "",
          `${address["firstName"] ?? ""} ${address["lastName"] ?? ""}`.trim(),
          address["city"] ?? "",
          item.productName,
          item.variantName ?? "",
          item.sku,
          item.quantity,
          item.unitPrice.toFixed(2),
          item.lineTotal.toFixed(2),
          order.discountTotal.toFixed(2),
          order.shippingTotal.toFixed(2),
          order.grandTotal.toFixed(2),
          order.couponCode ?? "",
        ]);
      }
    }

    return toCsv(
      [
        "Sipariş no",
        "Tarih",
        "Durum",
        "Ödeme durumu",
        "E-posta",
        "Müşteri",
        "İl",
        "Ürün",
        "Varyant",
        "SKU",
        "Adet",
        "Birim fiyat",
        "Satır tutarı",
        "İndirim",
        "Kargo",
        "Sipariş toplamı",
        "Kupon",
      ],
      rows,
    );
  }

  /** Ürünleri varyant bazında CSV olarak döndürür (fiyat/stok kontrolü için). */
  async productsCsv(): Promise<string> {
    const variants = await this.db().productVariant.findMany({
      orderBy: [{ product: { name: "asc" } }, { sku: "asc" }],
      take: MAX_ROWS,
      include: {
        product: {
          include: {
            category: { select: { name: true } },
            brand: { select: { name: true } },
          },
        },
        optionValues: { include: { optionValue: true } },
      },
    });

    return toCsv(
      [
        "Ürün",
        "Durum",
        "Kategori",
        "Marka",
        "SKU",
        "Barkod",
        "Seçenekler",
        "Fiyat",
        "Eski fiyat",
        "KDV %",
        "Stok",
        "Rezerve",
        "Aktif",
      ],
      variants.map((variant) => [
        variant.product.name,
        variant.product.status,
        variant.product.category.name,
        variant.product.brand?.name ?? "",
        variant.sku,
        variant.barcode ?? "",
        variant.optionValues.map((link) => link.optionValue.value).join(" / "),
        variant.price.toFixed(2),
        variant.compareAtPrice?.toFixed(2) ?? "",
        variant.product.taxRate.toFixed(2),
        variant.stockQuantity,
        variant.reservedQuantity,
        variant.isActive ? "Evet" : "Hayır",
      ]),
    );
  }
}
