import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/modules/auth/session";
import { getOrderService, getPaymentService } from "@/modules/orders/container";
import { isAppError } from "@/shared/errors";
import { getClientIp } from "@/shared/rate-limit";

export const metadata: Metadata = {
  title: "Güvenli ödeme",
  robots: { index: false },
};

async function PaymentContent({
  params,
  searchParams,
}: Pick<PageProps<"/odeme/ode/[orderNumber]">, "params" | "searchParams">) {
  const { orderNumber } = await params;
  const query = await searchParams;
  const token = typeof query["t"] === "string" ? query["t"] : null;
  const user = await getCurrentUser();

  let order;
  try {
    order = await getOrderService().getForAccess(orderNumber, {
      userId: user?.id ?? null,
      lookupToken: token,
    });
  } catch (error) {
    if (isAppError(error)) notFound();
    throw error;
  }

  if (order.status !== "PENDING_PAYMENT") {
    redirect(`/siparis/${order.orderNumber}?t=${order.lookupToken}`);
  }

  let payment: { paymentUrl: string; mode: "iframe" | "redirect" };
  try {
    payment = await getPaymentService().start(order.orderNumber, {
      customerIp: await getClientIp(),
    });
  } catch (error) {
    if (isAppError(error)) {
      return (
        <p role="alert" className="text-red-600">
          Ödeme sayfası açılamadı: {error.message}
        </p>
      );
    }
    throw error;
  }

  if (payment.mode === "redirect") redirect(payment.paymentUrl);

  return (
    <iframe
      src={payment.paymentUrl}
      title="Güvenli ödeme"
      className="h-[720px] w-full rounded-theme border border-border"
    />
  );
}

export default function PaymentPage({
  params,
  searchParams,
}: PageProps<"/odeme/ode/[orderNumber]">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Güvenli ödeme</h1>
      <Suspense
        fallback={
          <p className="text-muted-foreground">Ödeme sayfası hazırlanıyor...</p>
        }
      >
        <PaymentContent params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
