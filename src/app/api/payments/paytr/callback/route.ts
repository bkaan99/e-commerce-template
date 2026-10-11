import { connection } from "next/server";
import { getPaymentService } from "@/modules/orders/container";
import { isAppError } from "@/shared/errors";
import { reportError } from "@/shared/error-reporter";
import { paymentLogger } from "@/shared/logger";

/**
 * PayTR bildirim adresi. Başarıyla işlenen (veya daha önce işlenmiş) her
 * bildirime düz metin "OK" döner; aksi halde PayTR bildirimi tekrar dener.
 */
export async function POST(request: Request) {
  await connection();

  const form = await request.formData();
  const payload: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") payload[key] = value;
  }

  try {
    await getPaymentService().handleCallback(payload);
    return new Response("OK", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error) {
    if (isAppError(error) && error.httpStatus < 500) {
      // İmza/alan hatası: yeniden denemek anlamsız, ama "OK" de denmez.
      paymentLogger.warn({ code: error.code }, "Geçersiz ödeme bildirimi");
      return new Response("INVALID", { status: 400 });
    }

    reportError(error, { route: "paytr-callback" });
    return new Response("ERROR", { status: 500 });
  }
}
