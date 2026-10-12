import { formatMoney } from "@/shared/money";
import { escapeHtml, wrapInLayout, type RenderedEmail } from "./layout";

interface Context {
  siteName: string;
  baseUrl: string;
}

export interface ReturnDecision {
  orderNumber: string;
  approved: boolean;
  /** Onayda iade edilen tutar (örn. "149.90") */
  amount: string | null;
  currency: string;
  /** Redde müşteriye gösterilen açıklama */
  note: string | null;
}

/** İade talebinin onay/ret sonucunu müşteriye bildirir. */
export function renderReturnDecision(
  decision: ReturnDecision,
  context: Context,
): RenderedEmail {
  const orderNo = escapeHtml(decision.orderNumber);

  if (decision.approved) {
    const amount = decision.amount
      ? formatMoney(decision.amount, decision.currency)
      : null;
    const detail = amount
      ? `${amount} tutarındaki iade, ödeme yaptığınız yönteme yapıldı. Bankanıza bağlı olarak hesabınıza yansıması birkaç iş günü sürebilir.`
      : "İade ödeme yaptığınız yönteme yapıldı.";

    return {
      subject: `İade talebiniz onaylandı: ${decision.orderNumber}`,
      html: wrapInLayout({
        siteName: context.siteName,
        title: "İade talebiniz onaylandı",
        bodyHtml: `<p>${orderNo} numaralı siparişiniz için iade talebiniz onaylandı.</p><p>${escapeHtml(detail)}</p>`,
      }),
      text: `${decision.orderNumber} numaralı siparişiniz için iade talebiniz onaylandı.\n${detail}`,
    };
  }

  const note = decision.note?.trim();
  return {
    subject: `İade talebiniz hakkında: ${decision.orderNumber}`,
    html: wrapInLayout({
      siteName: context.siteName,
      title: "İade talebiniz kabul edilemedi",
      bodyHtml: `<p>${orderNo} numaralı siparişiniz için iade talebiniz kabul edilemedi.</p>
        ${note ? `<p>${escapeHtml(note)}</p>` : ""}
        <p>Sorularınız için bizimle iletişime geçebilirsiniz.</p>`,
    }),
    text: `${decision.orderNumber} numaralı siparişiniz için iade talebiniz kabul edilemedi.${note ? `\n${note}` : ""}\nSorularınız için bizimle iletişime geçebilirsiniz.`,
  };
}
