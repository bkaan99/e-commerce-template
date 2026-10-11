export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** HTML'e yazılacak kullanıcı verisini kaçırır. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface LayoutOptions {
  siteName: string;
  title: string;
  /** Satır içi HTML; çağıran kullanıcı verisini escapeHtml ile kaçırmalıdır. */
  bodyHtml: string;
}

/** Tüm e-postalarda ortak, tablo tabanlı ve satır içi stilli iskelet. */
export function wrapInLayout(options: LayoutOptions): string {
  return `<!doctype html>
<html lang="tr">
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#171717;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;">
      <tr><td style="padding:24px 24px 8px;font-size:18px;font-weight:bold;">${escapeHtml(options.siteName)}</td></tr>
      <tr><td style="padding:8px 24px 24px;font-size:15px;line-height:1.5;">
        <h1 style="font-size:20px;margin:0 0 16px;">${escapeHtml(options.title)}</h1>
        ${options.bodyHtml}
      </td></tr>
    </table>
  </body>
</html>`;
}
