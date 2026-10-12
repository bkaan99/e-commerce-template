import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Price } from "@/components/storefront/price";
import { features } from "@/config/features";
import { getDealerService } from "@/modules/b2b/container";
import { requireUser } from "@/modules/auth/session";
import { getOrderService } from "@/modules/orders/container";
import { ORDER_STATUS_LABELS } from "@/modules/orders/order-labels";

export const metadata: Metadata = {
  title: "Hesabım",
  robots: { index: false },
};

async function AccountContent() {
  const user = await requireUser();
  const orders = await getOrderService().listForUser(user.id);
  const dealer = features.b2b
    ? await getDealerService().getProfile(user.id)
    : null;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Bilgilerim</h2>
        <p>{user.name}</p>
        <p className="text-muted-foreground">{user.email}</p>
        <div className="flex gap-4 pt-1 text-sm">
          <Link href="/hesabim/adresler" className="underline">
            Adreslerim
          </Link>
          <Link href="/hesabim/ayarlar" className="underline">
            Hesap ayarları
          </Link>
        </div>
      </section>

      {features.b2b ? (
        <section className="flex flex-col gap-1 text-sm">
          <h2 className="text-lg font-semibold">Bayilik</h2>
          {dealer?.status === "APPROVED" ? (
            <p>
              Onaylı bayi{dealer.groupName ? ` · ${dealer.groupName}` : ""}
              {dealer.creditLimit
                ? ` · Kredi limiti: ${dealer.creditLimit} TL`
                : ""}
            </p>
          ) : dealer?.status === "PENDING" ? (
            <p className="text-muted-foreground">Başvurunuz inceleniyor.</p>
          ) : (
            <Link href="/bayi-basvuru" className="underline">
              Bayi başvurusu yap
            </Link>
          )}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Siparişlerim</h2>
        {orders.length === 0 ? (
          <p className="text-muted-foreground">Henüz siparişiniz yok.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {orders.map((order) => (
              <li
                key={order.id}
                className="flex items-center justify-between gap-4 py-3 text-sm"
              >
                <div className="flex flex-col">
                  <Link
                    href={`/siparis/${order.orderNumber}`}
                    className="font-medium underline"
                  >
                    {order.orderNumber}
                  </Link>
                  <span className="text-muted-foreground">
                    {order.createdAt.toLocaleDateString("tr-TR")} ·{" "}
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>
                </div>
                <Price value={order.grandTotal} currency={order.currency} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function AccountPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Hesabım</h1>
      <Suspense
        fallback={<p className="text-muted-foreground">Yükleniyor...</p>}
      >
        <AccountContent />
      </Suspense>
    </div>
  );
}
