import type { Metadata } from "next";
import { Suspense } from "react";
import { getStockAlertService } from "@/modules/stock-alerts/container";
import { isAppError } from "@/shared/errors";

export const metadata: Metadata = {
  title: "Bildirimden çık",
  robots: { index: false },
};

async function UnsubscribeContent({
  searchParams,
}: Pick<PageProps<"/bildirim-iptal">, "searchParams">) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";

  try {
    await getStockAlertService().unsubscribe(value);
  } catch (error) {
    return (
      <p role="alert" className="text-red-600">
        {isAppError(error) ? error.message : "Bağlantı geçersiz."}
      </p>
    );
  }

  return <p className="text-green-700">Stok bildirimlerinden çıkarıldınız.</p>;
}

export default function UnsubscribePage({
  searchParams,
}: PageProps<"/bildirim-iptal">) {
  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-2xl font-semibold">Bildirimden çık</h1>
      <Suspense fallback={null}>
        <UnsubscribeContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
