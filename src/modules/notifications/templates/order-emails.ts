import { formatMoney } from "@/shared/money";
import { trackingUrl } from "@/shared/shipping/carriers";
import type { OrderView } from "@/modules/orders/order.types";
import { escapeHtml, wrapInLayout, type RenderedEmail } from "./layout";

export interface EmailContext {
  siteName: string;
  baseUrl: string;
}

function orderLink(order: OrderView, context: EmailContext): string {
  return `${context.baseUrl}/siparis/${order.orderNumber}?t=${order.lookupToken}`;
}

function itemsTableHtml(order: OrderView): string {
  const rows = order.items
    .map(
      (item) => `<tr>
        <td style="padding:6px 0;border-bottom:1px solid #e4e4e7;">
          ${escapeHtml(item.productName)}${
            item.variantName
              ? `<br><span style="color:#71717a;font-size:13px;">${escapeHtml(item.variantName)}</span>`
              : ""
          }
        </td>
        <td style="padding:6px 8px;border-bottom:1px solid #e4e4e7;text-align:center;">${item.quantity}</td>
        <td style="padding:6px 0;border-bottom:1px solid #e4e4e7;text-align:right;">${escapeHtml(formatMoney(item.lineTotal, order.currency))}</td>
      </tr>`,
    )
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;font-size:14px;">${rows}</table>`;
}

function totalsHtml(order: OrderView): string {
  const line = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:2px 0;${strong ? "font-weight:bold;" : ""}">${label}</td><td style="padding:2px 0;text-align:right;${strong ? "font-weight:bold;" : ""}">${escapeHtml(value)}</td></tr>`;

  const rows = [
    line("Ara toplam", formatMoney(order.subtotal, order.currency)),
  ];
  if (Number(order.discountTotal) > 0) {
    rows.push(
      line("İndirim", `-${formatMoney(order.discountTotal, order.currency)}`),
    );
  }
  rows.push(line("Kargo", formatMoney(order.shippingTotal, order.currency)));
  rows.push(
    line("Toplam", formatMoney(order.grandTotal, order.currency), true),
  );

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">${rows.join("")}</table>`;
}

function itemsText(order: OrderView): string {
  return order.items
    .map(
      (item) =>
        `- ${item.productName}${item.variantName ? ` (${item.variantName})` : ""} x${item.quantity}: ${formatMoney(item.lineTotal, order.currency)}`,
    )
    .join("\n");
}

export function renderOrderConfirmation(
  order: OrderView,
  context: EmailContext,
): RenderedEmail {
  const link = orderLink(order, context);
  const name = order.shippingAddress.firstName;

  return {
    subject: `Siparişiniz alındı: ${order.orderNumber}`,
    html: wrapInLayout({
      siteName: context.siteName,
      title: "Siparişiniz alındı",
      bodyHtml: `<p>Merhaba ${escapeHtml(name)}, siparişiniz için teşekkürler. Ödemeniz onaylandı.</p>
        <p><strong>Sipariş no:</strong> ${escapeHtml(order.orderNumber)}</p>
        ${itemsTableHtml(order)}
        ${totalsHtml(order)}
        <p style="margin-top:20px;"><a href="${escapeHtml(link)}">Siparişimi görüntüle</a></p>`,
    }),
    text: `Merhaba ${name},\n\nSiparişiniz alındı. Sipariş no: ${order.orderNumber}\n\n${itemsText(order)}\n\nToplam: ${formatMoney(order.grandTotal, order.currency)}\n\nSiparişinizi görüntüleyin: ${link}`,
  };
}

export function renderOrderShipped(
  order: OrderView,
  context: EmailContext,
): RenderedEmail {
  const link = orderLink(order, context);
  const tracking = order.trackingNumber
    ? `${order.carrier ? `${order.carrier} ` : ""}takip no: ${order.trackingNumber}`
    : null;
  const trackLink = trackingUrl(order.carrier, order.trackingNumber);

  return {
    subject: `Siparişiniz kargoya verildi: ${order.orderNumber}`,
    html: wrapInLayout({
      siteName: context.siteName,
      title: "Siparişiniz kargoya verildi",
      bodyHtml: `<p>${escapeHtml(order.orderNumber)} numaralı siparişiniz yola çıktı.</p>
        ${tracking ? `<p><strong>${escapeHtml(tracking)}</strong></p>` : ""}
        ${trackLink ? `<p><a href="${escapeHtml(trackLink)}">Kargo takibi</a></p>` : ""}
        <p><a href="${escapeHtml(link)}">Siparişimi görüntüle</a></p>`,
    }),
    text: `${order.orderNumber} numaralı siparişiniz kargoya verildi.${tracking ? `\n${tracking}` : ""}${trackLink ? `\nKargo takibi: ${trackLink}` : ""}\n\n${link}`,
  };
}

export function renderOrderCancelled(
  order: OrderView,
  refunded: boolean,
  context: EmailContext,
): RenderedEmail {
  const note = refunded
    ? "Ödemeniz kartınıza iade edilecektir. İadenin hesabınıza yansıması bankanıza göre birkaç iş günü sürebilir."
    : "Siparişiniz için tahsilat yapılmamıştır.";

  return {
    subject: `Siparişiniz iptal edildi: ${order.orderNumber}`,
    html: wrapInLayout({
      siteName: context.siteName,
      title: "Siparişiniz iptal edildi",
      bodyHtml: `<p>${escapeHtml(order.orderNumber)} numaralı siparişiniz iptal edildi.</p><p>${escapeHtml(note)}</p>`,
    }),
    text: `${order.orderNumber} numaralı siparişiniz iptal edildi.\n${note}`,
  };
}

export function renderAdminNewOrder(
  order: OrderView,
  context: EmailContext,
): RenderedEmail {
  const customer = `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`;

  return {
    subject: `Yeni sipariş: ${order.orderNumber} (${formatMoney(order.grandTotal, order.currency)})`,
    html: wrapInLayout({
      siteName: context.siteName,
      title: "Yeni sipariş alındı",
      bodyHtml: `<p><strong>${escapeHtml(order.orderNumber)}</strong> · ${escapeHtml(customer)} · ${escapeHtml(order.email)}</p>
        ${itemsTableHtml(order)}
        ${totalsHtml(order)}`,
    }),
    text: `Yeni sipariş ${order.orderNumber}\n${customer} <${order.email}>\n\n${itemsText(order)}\n\nToplam: ${formatMoney(order.grandTotal, order.currency)}`,
  };
}

export function renderStockAvailable(
  product: { name: string; slug: string },
  context: EmailContext,
  unsubscribeUrl: string,
): RenderedEmail {
  const link = `${context.baseUrl}/urun/${product.slug}`;

  return {
    subject: `${product.name} yeniden stokta`,
    html: wrapInLayout({
      siteName: context.siteName,
      title: "Aradığınız ürün yeniden stokta",
      bodyHtml: `<p>Haber vermemizi istediğiniz <strong>${escapeHtml(product.name)}</strong> yeniden stokta.</p>
        <p><a href="${escapeHtml(link)}">Ürüne git</a></p>
        <p style="color:#71717a;font-size:12px;"><a href="${escapeHtml(unsubscribeUrl)}">Bildirimden çık</a></p>`,
    }),
    text: `${product.name} yeniden stokta: ${link}\n\nBildirimden çıkmak için: ${unsubscribeUrl}`,
  };
}

export interface BankAccountInfo {
  bank: string;
  accountName: string;
  iban: string;
}

/** Havale/EFT veya vadeli ödemeyle verilen sipariş için bilgilendirme. */
export function renderOrderPlacedManual(
  order: OrderView,
  method: "BANK_TRANSFER" | "DEFERRED",
  bankAccounts: readonly BankAccountInfo[],
  context: EmailContext,
): RenderedEmail {
  const link = orderLink(order, context);
  const total = formatMoney(order.grandTotal, order.currency);

  const accountsHtml = bankAccounts
    .map(
      (account) =>
        `<li>${escapeHtml(account.bank)} · ${escapeHtml(account.accountName)}<br><strong>${escapeHtml(account.iban)}</strong></li>`,
    )
    .join("");
  const accountsText = bankAccounts
    .map(
      (account) => `${account.bank} · ${account.accountName}: ${account.iban}`,
    )
    .join("\n");

  const intro =
    method === "BANK_TRANSFER"
      ? `Siparişiniz alındı. Ödemeyi havale/EFT ile yapmanızı bekliyoruz; ödeme onaylanınca siparişiniz hazırlanacak. Açıklama alanına sipariş numarasını (${order.orderNumber}) yazın.`
      : `Siparişiniz vadeli ödeme ile onaylandı ve hazırlanıyor.`;

  return {
    subject:
      method === "BANK_TRANSFER"
        ? `Siparişiniz alındı, ödeme bekleniyor: ${order.orderNumber}`
        : `Siparişiniz onaylandı: ${order.orderNumber}`,
    html: wrapInLayout({
      siteName: context.siteName,
      title:
        method === "BANK_TRANSFER"
          ? "Ödeme bekleniyor"
          : "Siparişiniz onaylandı",
      bodyHtml: `<p>${escapeHtml(intro)}</p>
        <p><strong>Tutar:</strong> ${escapeHtml(total)}</p>
        ${method === "BANK_TRANSFER" && bankAccounts.length > 0 ? `<ul>${accountsHtml}</ul>` : ""}
        ${itemsTableHtml(order)}
        <p><a href="${escapeHtml(link)}">Siparişimi görüntüle</a></p>`,
    }),
    text: `${intro}\n\nTutar: ${total}\n${method === "BANK_TRANSFER" ? `\n${accountsText}\n` : ""}\n${itemsText(order)}\n\n${link}`,
  };
}
