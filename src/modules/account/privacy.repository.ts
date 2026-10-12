import type { PrismaClient } from "@/shared/prisma-client";

export interface UserDataExport {
  exportedAt: string;
  account: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    emailVerified: boolean;
    createdAt: string;
  };
  addresses: Record<string, unknown>[];
  orders: Record<string, unknown>[];
  wishlist: { product: string; slug: string }[];
  dealer: Record<string, unknown> | null;
  stockAlerts: { product: string; sku: string; createdAt: string }[];
}

export interface PrivacyRepository {
  collectExport(userId: string): Promise<UserDataExport | null>;
  /** Teslimi veya ödemesi tamamlanmamış sipariş sayısı. */
  openOrderCount(userId: string): Promise<number>;
  findIdentity(userId: string): Promise<{
    email: string;
    type: "CUSTOMER" | "STAFF";
    passwordHash: string | null;
    anonymized: boolean;
  } | null>;
  /** Kişisel verileri siler/anonimleştirir; yasal saklama gereken siparişler korunur. */
  anonymize(userId: string): Promise<void>;
}

export class PrismaPrivacyRepository implements PrivacyRepository {
  constructor(private readonly db: () => PrismaClient) {}

  async collectExport(userId: string): Promise<UserDataExport | null> {
    const user = await this.db().user.findUnique({
      where: { id: userId },
      include: {
        addresses: true,
        customer: { include: { group: { select: { name: true } } } },
        wishlist: {
          include: { product: { select: { name: true, slug: true } } },
        },
        orders: {
          orderBy: { createdAt: "desc" },
          include: { items: true, payments: true },
        },
      },
    });
    if (!user) return null;

    const alerts = await this.db().backInStockSubscription.findMany({
      where: { email: user.email },
      include: {
        variant: { select: { sku: true, product: { select: { name: true } } } },
      },
    });

    return {
      exportedAt: new Date().toISOString(),
      account: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        emailVerified: user.emailVerifiedAt !== null,
        createdAt: user.createdAt.toISOString(),
      },
      addresses: user.addresses.map((address) => ({
        title: address.title,
        firstName: address.firstName,
        lastName: address.lastName,
        phone: address.phone,
        city: address.city,
        district: address.district,
        neighborhood: address.neighborhood,
        addressLine: address.addressLine,
        postalCode: address.postalCode,
        invoiceType: address.invoiceType,
        companyName: address.companyName,
        taxNumber: address.taxNumber,
        taxOffice: address.taxOffice,
      })),
      orders: user.orders.map((order) => ({
        orderNumber: order.orderNumber,
        createdAt: order.createdAt.toISOString(),
        status: order.status,
        paymentStatus: order.paymentStatus,
        currency: order.currency,
        subtotal: order.subtotal.toFixed(2),
        discountTotal: order.discountTotal.toFixed(2),
        shippingTotal: order.shippingTotal.toFixed(2),
        grandTotal: order.grandTotal.toFixed(2),
        couponCode: order.couponCode,
        shippingAddress: order.shippingAddress,
        billingAddress: order.billingAddress,
        items: order.items.map((item) => ({
          product: item.productName,
          variant: item.variantName,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toFixed(2),
          lineTotal: item.lineTotal.toFixed(2),
        })),
        payments: order.payments.map((payment) => ({
          method: payment.method,
          status: payment.status,
          amount: payment.amount.toFixed(2),
          paidAt: payment.paidAt?.toISOString() ?? null,
        })),
      })),
      wishlist: user.wishlist.map((item) => ({
        product: item.product.name,
        slug: item.product.slug,
      })),
      dealer: user.customer
        ? {
            status: user.customer.b2bStatus,
            companyName: user.customer.companyName,
            taxNumber: user.customer.taxNumber,
            taxOffice: user.customer.taxOffice,
            group: user.customer.group?.name ?? null,
          }
        : null,
      stockAlerts: alerts.map((alert) => ({
        product: alert.variant.product.name,
        sku: alert.variant.sku,
        createdAt: alert.createdAt.toISOString(),
      })),
    };
  }

  openOrderCount(userId: string): Promise<number> {
    return this.db().order.count({
      where: {
        userId,
        OR: [
          {
            status: {
              in: ["PENDING_PAYMENT", "PAID", "PROCESSING", "SHIPPED"],
            },
          },
          // Teslim edilmiş ama vadeli ödemesi tahsil edilmemiş sipariş
          { status: "DELIVERED", paymentStatus: "PENDING" },
        ],
      },
    });
  }

  async findIdentity(userId: string) {
    const user = await this.db().user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        type: true,
        passwordHash: true,
        anonymizedAt: true,
      },
    });
    return user
      ? {
          email: user.email,
          type: user.type,
          passwordHash: user.passwordHash,
          anonymized: user.anonymizedAt !== null,
        }
      : null;
  }

  async anonymize(userId: string): Promise<void> {
    await this.db().$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { email: true },
      });

      await tx.address.deleteMany({ where: { userId } });
      await tx.wishlistItem.deleteMany({ where: { userId } });
      await tx.cart.deleteMany({ where: { userId } });
      await tx.backInStockSubscription.deleteMany({
        where: { email: user.email },
      });
      await tx.userRole.deleteMany({ where: { userId } });

      await tx.customer.updateMany({
        where: { userId },
        data: {
          b2bStatus: "NONE",
          groupId: null,
          companyName: null,
          taxNumber: null,
          taxOffice: null,
          creditLimit: null,
          minOrderAmount: null,
          b2bNote: null,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          // Sipariş kayıtları yasal saklama gereği korunur; kimlik bağlantısı kopar.
          email: `silinmis-${userId}@anonim.invalid`,
          firstName: "Silinmiş",
          lastName: "Kullanıcı",
          phone: null,
          passwordHash: null,
          isActive: false,
          emailVerifiedAt: null,
          anonymizedAt: new Date(),
        },
      });
    });
  }
}
